import {
  LandingPageSettings,
  LandingPageStat,
  LandingPageRequirement,
  LandingPageStep,
  LandingPageSchedule,
  LandingPageFaq,
  LandingPageContact,
  LandingPageAnnouncement,
  LandingPageVersion,
  LandingPageSnapshot
} from '../types/cms';
import { getStorageData, saveStorageData } from '../lib/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { initialLandingSnapshot } from '../lib/cmsSeeds';

// In-memory cache for ultra-fast landing page delivery without query explosion
let cachedPublishedSnapshot: LandingPageSnapshot | null = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory TTL, invalidated instantly on publish

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class CmsService {
  // ==========================================================================
  // 1. PUBLIC LANDING PAGE CONSUMPTION (PUBLISHED CONTENT ONLY)
  // ==========================================================================

  /**
   * Fetches published content.
   * Public users / candidates can ONLY see published content.
   * Uses cached snapshot for speed, with robust fallback.
   */
  async getPublishedContent(forceRefresh = false): Promise<LandingPageSnapshot> {
    const now = Date.now();
    if (!forceRefresh && cachedPublishedSnapshot && (now - lastCacheTimestamp < CACHE_TTL_MS)) {
      return cachedPublishedSnapshot;
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('landing_page_versions')
          .select('*')
          .eq('status', 'PUBLISHED')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.content_snapshot) {
          cachedPublishedSnapshot = data.content_snapshot as LandingPageSnapshot;
          lastCacheTimestamp = now;
          return cachedPublishedSnapshot;
        }
      } catch (e) {
        console.warn('Fallback reading published CMS from local storage', e);
      }
    }

    // Local storage fallback
    const data = getStorageData();
    const publishedVersion = [...data.landingVersions]
      .filter(v => v.status === 'PUBLISHED')
      .sort((a, b) => b.version_number - a.version_number)[0];

    if (publishedVersion?.content_snapshot) {
      cachedPublishedSnapshot = publishedVersion.content_snapshot;
      lastCacheTimestamp = now;
      return cachedPublishedSnapshot;
    }

    // Emergency minimum fallback
    cachedPublishedSnapshot = {
      settings: data.landingSettings || initialLandingSnapshot.settings,
      stats: data.landingStats?.length > 0 ? data.landingStats : initialLandingSnapshot.stats,
      requirements: data.landingRequirements?.length > 0 ? data.landingRequirements : initialLandingSnapshot.requirements,
      steps: data.landingSteps?.length > 0 ? data.landingSteps : initialLandingSnapshot.steps,
      schedules: data.landingSchedules?.length > 0 ? data.landingSchedules : initialLandingSnapshot.schedules,
      faqs: data.landingFaqs?.length > 0 ? data.landingFaqs : initialLandingSnapshot.faqs,
      contacts: data.landingContacts?.length > 0 ? data.landingContacts : initialLandingSnapshot.contacts,
      announcements: data.landingAnnouncements || initialLandingSnapshot.announcements,
    };
    lastCacheTimestamp = now;
    return cachedPublishedSnapshot;
  }

  // ==========================================================================
  // 2. DRAFT & WORKING CONTENT (ADMIN CMS & PREVIEW ONLY)
  // ==========================================================================

  /**
   * Fetches current working draft data for editor.
   * Visible only to authorized staff.
   */
  async getDraftContent(): Promise<LandingPageSnapshot> {
    const data = getStorageData();
    return {
      settings: { ...data.landingSettings },
      stats: [...data.landingStats].sort((a, b) => a.sort_order - b.sort_order),
      requirements: [...data.landingRequirements].sort((a, b) => a.sort_order - b.sort_order),
      steps: [...data.landingSteps].sort((a, b) => a.sort_order - b.sort_order),
      schedules: [...data.landingSchedules].sort((a, b) => a.sort_order - b.sort_order),
      faqs: [...data.landingFaqs].sort((a, b) => a.sort_order - b.sort_order),
      contacts: [...data.landingContacts].sort((a, b) => a.sort_order - b.sort_order),
      announcements: [...data.landingAnnouncements],
    };
  }

  /**
   * Updates working draft.
   * Panitia and Super Admin can save drafts.
   */
  async saveDraftContent(
    snapshot: LandingPageSnapshot,
    user: { id?: string; email?: string; role?: string; name?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (user.role && !['SUPER_ADMIN', 'PANITIA'].includes(user.role)) {
        return {
          success: false,
          error: `Akses Ditolak (403): Role "${user.role}" tidak memiliki wewenang untuk mengedit draf CMS.`,
        };
      }
      // Validation: Jangan sampai admin dapat menyimpan tombol dengan text kosong
      if (snapshot.settings.cta_primary_button_active !== false && !snapshot.settings.cta_primary_button_text?.trim()) {
        return { success: false, error: 'Text tombol wajib diisi (Tombol Utama CTA Bawah).' };
      }
      if (snapshot.settings.cta_secondary_button_active !== false && !snapshot.settings.cta_secondary_button_text?.trim()) {
        return { success: false, error: 'Text tombol wajib diisi (Tombol Sekunder CTA Bawah).' };
      }
      if (!snapshot.settings.hero_primary_button_text?.trim()) {
        return { success: false, error: 'Text tombol wajib diisi (Tombol Utama Hero).' };
      }
      if (!snapshot.settings.hero_secondary_button_text?.trim()) {
        return { success: false, error: 'Text tombol wajib diisi (Tombol Sekunder Hero).' };
      }

      const data = getStorageData();
      data.landingSettings = { ...snapshot.settings, updated_at: new Date().toISOString() };
      data.landingStats = [...snapshot.stats];
      data.landingRequirements = [...snapshot.requirements];
      data.landingSteps = [...snapshot.steps];
      data.landingSchedules = [...snapshot.schedules];
      data.landingFaqs = [...snapshot.faqs];
      data.landingContacts = [...snapshot.contacts];
      data.landingAnnouncements = [...snapshot.announcements];

      saveStorageData(data);

      await auditService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'LANDING_PAGE_UPDATED',
        entityType: 'CMS_LANDING_PAGE',
        entityId: 'landing-settings-primary',
        newValue: { site_name: snapshot.settings.site_name, academic_year: snapshot.settings.academic_year },
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal menyimpan draft CMS.' };
    }
  }

  // ==========================================================================
  // 3. VALIDATION BEFORE PUBLISH
  // ==========================================================================

  validateContent(snapshot: LandingPageSnapshot): ContentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic Settings
    if (!snapshot.settings.site_name?.trim()) errors.push('Nama lembaga wajib diisi.');
    if (!snapshot.settings.academic_year?.trim()) errors.push('Tahun pelajaran wajib diisi.');
    if (!snapshot.settings.hero_title?.trim()) errors.push('Judul hero utama wajib diisi.');
    if (!snapshot.settings.hero_description?.trim()) errors.push('Deskripsi hero wajib diisi.');
    if (!snapshot.settings.hero_primary_button_text?.trim()) errors.push('Teks tombol utama wajib diisi.');
    if (!snapshot.settings.hero_primary_button_link?.trim()) errors.push('Link tombol utama wajib diisi.');

    // CTA Bottom Validation (Prompt requirement: Text tombol wajib diisi)
    if (snapshot.settings.cta_primary_button_active !== false) {
      if (!snapshot.settings.cta_primary_button_text?.trim()) {
        errors.push('Text tombol wajib diisi (Tombol Utama CTA Bawah).');
      }
      if (!snapshot.settings.cta_primary_button_link?.trim()) {
        errors.push('Link tombol utama CTA bawah wajib diisi.');
      }
    }
    if (snapshot.settings.cta_secondary_button_active !== false) {
      if (!snapshot.settings.cta_secondary_button_text?.trim()) {
        errors.push('Text tombol wajib diisi (Tombol Sekunder CTA Bawah).');
      }
    }

    // XSS check in plain text fields
    const checkXss = (str: string, label: string) => {
      if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(str)) {
        errors.push(`Potensi kode HTML/Script berbahaya terdeteksi pada ${label}.`);
      }
    };
    checkXss(snapshot.settings.hero_title, 'Judul Hero');
    checkXss(snapshot.settings.hero_description, 'Deskripsi Hero');

    // Stats
    const activeStats = snapshot.stats.filter(s => s.is_active);
    if (activeStats.length === 0) {
      warnings.push('Tidak ada statistik aktif yang akan ditampilkan di hero.');
    }
    activeStats.forEach((s, idx) => {
      if (!s.label.trim()) errors.push(`Statistik #${idx + 1}: Label tidak boleh kosong.`);
      if (!s.value.trim()) errors.push(`Statistik #${idx + 1}: Nilai tidak boleh kosong.`);
    });

    // FAQs
    const activeFaqs = snapshot.faqs.filter(f => f.is_active);
    activeFaqs.forEach((f, idx) => {
      if (!f.question.trim()) errors.push(`FAQ #${idx + 1}: Pertanyaan tidak boleh kosong.`);
      if (!f.answer.trim()) errors.push(`FAQ #${idx + 1}: Jawaban tidak boleh kosong.`);
    });

    // Schedules
    const activeSchedules = snapshot.schedules.filter(s => s.is_active);
    activeSchedules.forEach((sch, idx) => {
      if (!sch.title.trim()) errors.push(`Jadwal #${idx + 1}: Judul kegiatan tidak boleh kosong.`);
      if (!sch.event_date_text.trim()) errors.push(`Jadwal #${idx + 1}: Tanggal kegiatan tidak boleh kosong.`);
    });

    // Contacts
    const activeContacts = snapshot.contacts.filter(c => c.is_active);
    if (activeContacts.length === 0) {
      warnings.push('Tidak ada kontak aktif (WhatsApp/Email) untuk dihubungi pendaftar.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==========================================================================
  // 4. PUBLISH & VERSIONING
  // ==========================================================================

  /**
   * Publishes the current draft to public.
   * Restricted: SUPER_ADMIN only. PANITIA and PIMPINAN are strictly rejected.
   */
  async publishContent(
    user: { id?: string; email?: string; role?: string; name?: string },
    notes?: string
  ): Promise<{ success: boolean; error?: string; versionNumber?: number }> {
    // Role Authorization Check (Strict Super Admin only)
    if (user.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak (403): Hanya SUPER_ADMIN yang memiliki hak untuk mempublikasikan konten ke publik.',
      };
    }

    const currentDraft = await this.getDraftContent();
    const validation = this.validateContent(currentDraft);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Validasi konten gagal:\n• ${validation.errors.join('\n• ')}`,
      };
    }

    const data = getStorageData();

    // Determine next version number
    const maxVersion = data.landingVersions.reduce((max, v) => Math.max(max, v.version_number || 0), 0);
    const newVersionNumber = maxVersion + 1;

    // Archive previously published versions
    data.landingVersions.forEach(v => {
      if (v.status === 'PUBLISHED') {
        v.status = 'ARCHIVED';
      }
    });

    const nowIso = new Date().toISOString();
    const newVersion: LandingPageVersion = {
      id: 'ver-' + Date.now(),
      version_number: newVersionNumber,
      content_snapshot: currentDraft,
      status: 'PUBLISHED',
      created_by: user.id,
      created_by_name: user.name || user.email || 'Admin',
      created_at: nowIso,
      published_by: user.id,
      published_by_name: user.name || user.email || 'Admin',
      published_at: nowIso,
      notes: notes || `Publikasi Versi #${newVersionNumber}`,
    };

    data.landingVersions.unshift(newVersion);
    saveStorageData(data);

    // Invalidate public cache immediately
    cachedPublishedSnapshot = currentDraft;
    lastCacheTimestamp = Date.now();

    // Also persist to Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('landing_page_versions').insert({
          id: newVersion.id,
          version_number: newVersion.version_number,
          content_snapshot: newVersion.content_snapshot,
          status: 'PUBLISHED',
          created_by: user.id,
          created_by_name: newVersion.created_by_name,
          published_by: user.id,
          published_by_name: newVersion.published_by_name,
          published_at: nowIso,
          notes: newVersion.notes,
        });

        // Also update singleton landing_page_settings so database field logo_path & content are in sync
        const s = currentDraft.settings;
        await supabase.from('landing_page_settings').upsert({
          id: s.id,
          site_name: s.site_name,
          site_short_name: s.site_short_name,
          academic_year: s.academic_year,
          program_label: s.program_label,
          logo_path: s.logo_path || null,
          favicon_path: s.favicon_path || null,
          hero_badge: s.hero_badge,
          hero_title: s.hero_title,
          hero_highlight: s.hero_highlight,
          hero_subtitle: s.hero_subtitle || null,
          hero_description: s.hero_description,
          hero_primary_button_text: s.hero_primary_button_text,
          hero_primary_button_link: s.hero_primary_button_link,
          hero_secondary_button_text: s.hero_secondary_button_text,
          hero_secondary_button_link: s.hero_secondary_button_link,
          meta_title: s.meta_title || null,
          meta_description: s.meta_description || null,
          og_title: s.og_title || null,
          og_description: s.og_description || null,
          og_image: s.og_image || null,
          cta_title: s.cta_title || null,
          cta_description: s.cta_description || null,
          cta_primary_button_text: s.cta_primary_button_text || 'Daftar Sekarang',
          cta_primary_button_link: s.cta_primary_button_link || '/register',
          cta_primary_button_active: s.cta_primary_button_active !== false,
          cta_secondary_button_text: s.cta_secondary_button_text || 'Hubungi Panitia',
          cta_secondary_button_link: s.cta_secondary_button_link || null,
          cta_secondary_button_active: s.cta_secondary_button_active !== false,
          updated_by: user.id,
          updated_at: nowIso,
        });
      } catch (e) {
        console.warn('Failed to insert published version or update landing_page_settings in Supabase', e);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'LANDING_PAGE_PUBLISHED',
      entityType: 'CMS_VERSION',
      entityId: newVersion.id,
      newValue: { version_number: newVersionNumber, notes: newVersion.notes },
    });

    return { success: true, versionNumber: newVersionNumber };
  }

  // ==========================================================================
  // 5. ROLLBACK TO PREVIOUS VERSION
  // ==========================================================================

  /**
   * Restores an older version snapshot without overwriting or deleting historical logs.
   * Generates a NEW published version from the old snapshot.
   */
  async rollbackToVersion(
    versionId: string,
    user: { id?: string; email?: string; role?: string; name?: string }
  ): Promise<{ success: boolean; error?: string; restoredVersionNumber?: number }> {
    if (user.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPER_ADMIN yang diizinkan melakukan pemulihan (rollback) konten.',
      };
    }

    const data = getStorageData();
    const targetVersion = data.landingVersions.find(v => v.id === versionId);
    if (!targetVersion) {
      return { success: false, error: 'Versi target yang ingin dipulihkan tidak ditemukan.' };
    }

    const restoredSnapshot = targetVersion.content_snapshot;
    const maxVersion = data.landingVersions.reduce((max, v) => Math.max(max, v.version_number || 0), 0);
    const newVersionNumber = maxVersion + 1;

    // Archive current published versions
    data.landingVersions.forEach(v => {
      if (v.status === 'PUBLISHED') {
        v.status = 'ARCHIVED';
      }
    });

    const nowIso = new Date().toISOString();
    const rollbackVersion: LandingPageVersion = {
      id: 'ver-' + Date.now(),
      version_number: newVersionNumber,
      content_snapshot: restoredSnapshot,
      status: 'PUBLISHED',
      created_by: user.id,
      created_by_name: user.name || user.email || 'Super Admin',
      created_at: nowIso,
      published_by: user.id,
      published_by_name: user.name || user.email || 'Super Admin',
      published_at: nowIso,
      notes: `Rollback ke snapshot Versi #${targetVersion.version_number} (${targetVersion.notes || 'Arsip'})`,
    };

    data.landingVersions.unshift(rollbackVersion);

    // Apply restored snapshot to active draft so admin editor also reflects the restored state
    data.landingSettings = { ...restoredSnapshot.settings, updated_at: nowIso };
    data.landingStats = [...restoredSnapshot.stats];
    data.landingRequirements = [...restoredSnapshot.requirements];
    data.landingSteps = [...restoredSnapshot.steps];
    data.landingSchedules = [...restoredSnapshot.schedules];
    data.landingFaqs = [...restoredSnapshot.faqs];
    data.landingContacts = [...restoredSnapshot.contacts];
    data.landingAnnouncements = [...restoredSnapshot.announcements];

    saveStorageData(data);

    // Invalidate public cache
    cachedPublishedSnapshot = restoredSnapshot;
    lastCacheTimestamp = Date.now();

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'LANDING_PAGE_ROLLBACK',
      entityType: 'CMS_VERSION',
      entityId: rollbackVersion.id,
      oldValue: { restored_from_version: targetVersion.version_number },
      newValue: { new_version_number: newVersionNumber },
    });

    return { success: true, restoredVersionNumber: newVersionNumber };
  }

  // ==========================================================================
  // 6. VERSION HISTORY
  // ==========================================================================

  async getVersions(): Promise<LandingPageVersion[]> {
    const data = getStorageData();
    return [...data.landingVersions].sort((a, b) => b.version_number - a.version_number);
  }

  // ==========================================================================
  // 7. PUBLIC ASSET UPLOAD & LOGO MANAGEMENT
  // ==========================================================================

  /**
   * Specifically validates and uploads Logo for CMS Landing Page.
   * Bucket: landing-page-assets (strictly separate from candidate-documents).
   * Validates: max 2MB, PNG/JPEG/WEBP only (SVG strictly rejected for security).
   * Generates sanitized path: logos/logo-{timestamp}-{random}.{ext}.
   * Uploads to Supabase Storage if configured; returns public URL.
   * If local mode, securely saves fallback data URL.
   * Removes previous logo if replacing.
   */
  async uploadLogo(
    file: File,
    user: { id?: string; email?: string; role?: string; name?: string }
  ): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
    // 1. Role permission check
    if (!['SUPER_ADMIN', 'PANITIA'].includes(user.role || '')) {
      return { success: false, error: 'Akses Ditolak: Anda tidak memiliki izin mengunggah logo website.' };
    }

    // 2. Size validation (max 2 MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'Ukuran file logo melebihi batas maksimal 2 MB.' };
    }

    // 3. Strict SVG rejection for security (prompt requirement 4)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      return {
        success: false,
        error: 'Format file SVG ditolak demi keamanan sistem (potensi XSS/Script Injection). Harap gunakan format PNG, JPG/JPEG, atau WEBP.',
      };
    }

    // 4. Strict format / MIME type validation
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      return {
        success: false,
        error: 'Format file tidak didukung. Logo hanya boleh bertipe PNG, JPG, JPEG, atau WEBP.',
      };
    }

    // 5. Extension validation & sanitization
    const rawExt = file.name.split('.').pop()?.toLowerCase();
    const safeExt = rawExt === 'jpeg' ? 'jpeg' : rawExt === 'webp' ? 'webp' : rawExt === 'jpg' ? 'jpg' : 'png';
    const safeFileName = `current-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
    const filePath = `landing-page/logo/${safeFileName}`;

    const data = getStorageData();
    const oldLogoPath = data.landingSettings?.logo_path;

    // 6. Upload to Supabase Storage if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('landing-page-assets')
          .upload(filePath, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('Supabase logo upload error:', uploadError);
          if (uploadError.message?.toLowerCase().includes('bucket not found') || uploadError.message?.toLowerCase().includes('not found')) {
            return {
              success: false,
              error: 'Bucket Supabase Storage "landing-page-assets" belum dibuat. Harap jalankan Migration 007 di menu Database Guide / Supabase SQL Editor.',
            };
          }
          if (uploadError.message?.toLowerCase().includes('policy') || uploadError.message?.toLowerCase().includes('row-level security')) {
            return {
              success: false,
              error: 'Akses penyimpanan ditolak oleh Storage RLS Policy. Pastikan akun memiliki peran SUPER_ADMIN atau PANITIA.',
            };
          }
          return {
            success: false,
            error: `Gagal mengunggah logo ke Supabase Storage: ${uploadError.message}`,
          };
        }

        // Retrieve public URL
        const { data: publicUrlData } = supabase.storage
          .from('landing-page-assets')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        // Try deleting previous logo file from storage if it belonged to landing-page-assets
        if (oldLogoPath && oldLogoPath.includes('landing-page-assets')) {
          try {
            const parts = oldLogoPath.split('/landing-page-assets/');
            if (parts.length > 1) {
              const oldFileKey = parts[1].split('?')[0];
              await supabase.storage.from('landing-page-assets').remove([oldFileKey]);
            }
          } catch (delErr) {
            console.warn('Could not delete old logo file from storage', delErr);
          }
        }

        // Update database settings row if available
        try {
          await supabase
            .from('landing_page_settings')
            .update({
              logo_path: publicUrl,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            })
            .eq('id', data.landingSettings.id);
        } catch (dbErr) {
          console.warn('Could not update landing_page_settings in Supabase db directly', dbErr);
        }

        // Update local working draft settings
        const nowIso = new Date().toISOString();
        data.landingSettings.logo_path = publicUrl;
        data.landingSettings.logo_url = publicUrl;
        data.landingSettings.updated_at = nowIso;
        saveStorageData(data);

        await auditService.logAction({
          userId: user.id,
          userEmail: user.email,
          action: 'LANDING_PAGE_LOGO_UPLOADED',
          entityType: 'CMS_LOGO',
          entityId: filePath,
          newValue: { url: publicUrl, fileSize: file.size, fileType: file.type },
        });

        return { success: true, url: publicUrl, path: filePath };
      } catch (err: any) {
        console.error('Upload logo exception:', err);
        return {
          success: false,
          error: err.message || 'Terjadi kesalahan saat mengunggah logo ke storage.',
        };
      }
    }

    // 7. Local storage / Demo fallback mode (when Supabase is not connected)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const localDataUrl = reader.result as string;
        const nowIso = new Date().toISOString();

        data.landingSettings.logo_path = localDataUrl;
        data.landingSettings.logo_url = localDataUrl;
        data.landingSettings.updated_at = nowIso;
        saveStorageData(data);

        await auditService.logAction({
          userId: user.id,
          userEmail: user.email,
          action: 'LANDING_PAGE_LOGO_UPLOADED',
          entityType: 'CMS_LOGO',
          entityId: filePath,
          newValue: { fileName: file.name, fileSize: file.size, fileType: file.type, mode: 'local_storage' },
        });

        resolve({ success: true, url: localDataUrl, path: filePath });
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Gagal memproses file logo di browser.' });
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Removes logo and restores default branding.
   */
  async deleteLogo(
    user: { id?: string; email?: string; role?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!['SUPER_ADMIN', 'PANITIA'].includes(user.role || '')) {
      return { success: false, error: 'Akses Ditolak: Anda tidak memiliki izin menghapus logo.' };
    }

    const data = getStorageData();
    const oldLogo = data.landingSettings.logo_path;

    if (isSupabaseConfigured() && supabase && oldLogo && oldLogo.includes('landing-page-assets')) {
      try {
        const parts = oldLogo.split('/landing-page-assets/');
        if (parts.length > 1) {
          const oldFileKey = parts[1].split('?')[0];
          await supabase.storage.from('landing-page-assets').remove([oldFileKey]);
        }
      } catch (e) {
        console.warn('Failed to delete logo file from Supabase storage', e);
      }
    }

    const nowIso = new Date().toISOString();
    delete data.landingSettings.logo_path;
    delete data.landingSettings.logo_url;
    data.landingSettings.updated_at = nowIso;
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('landing_page_settings')
          .update({
            logo_path: null,
            updated_at: nowIso,
            updated_by: user.id,
          })
          .eq('id', data.landingSettings.id);
      } catch (dbErr) {
        console.warn('Error clearing logo_path in Supabase', dbErr);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'LANDING_PAGE_LOGO_DELETED',
      entityType: 'CMS_LOGO',
      oldValue: { previous_logo: oldLogo },
    });

    return { success: true };
  }

  /**
   * Handles public asset uploads for CMS (hero banners, general illustrations).
   * Validates MIME type, extension, and file size.
   * Strictly separated from private candidate documents.
   */
  async uploadPublicAsset(
    file: File,
    user: { id?: string; email?: string; role?: string }
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!['SUPER_ADMIN', 'PANITIA'].includes(user.role || '')) {
      return { success: false, error: 'Akses Ditolak: Anda tidak memiliki izin mengunggah aset publik.' };
    }

    // Validate size (max 2MB for public web assets)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'Ukuran file aset melebihi batas maksimal 2 MB.' };
    }

    // Reject SVG for security
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      return { success: false, error: 'Format file SVG ditolak demi keamanan sistem.' };
    }

    // Validate MIME
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      return { success: false, error: 'Format file tidak diizinkan. Hanya format JPG, PNG, atau WEBP yang diperbolehkan.' };
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        await auditService.logAction({
          userId: user.id,
          userEmail: user.email,
          action: 'LANDING_PAGE_ASSET_UPLOADED',
          entityType: 'CMS_ASSET',
          newValue: { fileName: file.name, fileSize: file.size, fileType: file.type },
        });

        resolve({ success: true, url: dataUrl });
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Gagal membaca file gambar.' });
      };
      reader.readAsDataURL(file);
    });
  }
}

export const getLogoUrlWithCacheBust = (url?: string, updatedAt?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return `${url}${separator}v=${timestamp}`;
};

export const cmsService = new CmsService();
