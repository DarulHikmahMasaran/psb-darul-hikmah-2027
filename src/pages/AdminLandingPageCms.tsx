import { showToastNotification, confirmAction } from '../utils/notify';
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cmsService, getLogoUrlWithCacheBust } from '../services/cmsService';
import {
  LandingPageSnapshot,
  LandingPageStat,
  LandingPageRequirement,
  LandingPageStep,
  LandingPageSchedule,
  LandingPageFaq,
  LandingPageContact,
  LandingPageAnnouncement,
  LandingPageVersion
} from '../types/cms';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import {
  Layout,
  BarChart2,
  ListOrdered,
  Calendar,
  HelpCircle,
  Phone,
  Share2,
  Megaphone,
  Search,
  History,
  Save,
  Eye,
  Send,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Upload,
  Globe,
  Check,
  X,
  FileCheck,
  ImageIcon,
  ShieldCheck,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export interface AdminLandingPageCmsProps {
  onNavigate: (route: string) => void;
}

export const AdminLandingPageCms: React.FC<AdminLandingPageCmsProps> = ({ onNavigate }) => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'beranda' | 'statistik' | 'persyaratan' | 'alur' | 'jadwal' | 'faq' | 'kontak' | 'sosmed' | 'banner' | 'seo' | 'history'
  >('beranda');

  const [snapshot, setSnapshot] = useState<LandingPageSnapshot | null>(null);
  const [versions, setVersions] = useState<LandingPageVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Logo Upload State
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Publish Modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');

  // Rollback Modal
  const [rollbackTarget, setRollbackTarget] = useState<LandingPageVersion | null>(null);
  const [isRollbackLoading, setIsRollbackLoading] = useState(false);

  // Sub-items modals (Stat, Requirement, Step, Schedule, Faq, Contact)
  const [editingStat, setEditingStat] = useState<LandingPageStat | null>(null);
  const [isStatModalOpen, setIsStatModalOpen] = useState(false);

  const [editingReq, setEditingReq] = useState<LandingPageRequirement | null>(null);
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);

  const [editingStep, setEditingStep] = useState<LandingPageStep | null>(null);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<LandingPageSchedule | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const [editingFaq, setEditingFaq] = useState<LandingPageFaq | null>(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  const [editingContact, setEditingContact] = useState<LandingPageContact | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canPublish = isSuperAdmin;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [draft, historyList] = await Promise.all([
        cmsService.getDraftContent(),
        cmsService.getVersions(),
      ]);
      setSnapshot(draft);
      setVersions(historyList);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Gagal memuat konten draft CMS.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!snapshot) return;

    // Validasi Text Tombol: Jangan sampai admin dapat menyimpan tombol dengan text kosong
    if (snapshot.settings.cta_primary_button_active !== false && !snapshot.settings.cta_primary_button_text?.trim()) {
      setNotification({ type: 'error', message: 'Validasi Gagal: Text tombol wajib diisi (Tombol Utama CTA Bawah).' });
      return;
    }
    if (snapshot.settings.cta_secondary_button_active !== false && !snapshot.settings.cta_secondary_button_text?.trim()) {
      setNotification({ type: 'error', message: 'Validasi Gagal: Text tombol wajib diisi (Tombol Sekunder CTA Bawah).' });
      return;
    }
    if (!snapshot.settings.hero_primary_button_text?.trim()) {
      setNotification({ type: 'error', message: 'Validasi Gagal: Text tombol wajib diisi (Tombol Utama Hero).' });
      return;
    }
    if (!snapshot.settings.hero_secondary_button_text?.trim()) {
      setNotification({ type: 'error', message: 'Validasi Gagal: Text tombol wajib diisi (Tombol Sekunder Hero).' });
      return;
    }

    setIsSaving(true);
    setNotification(null);
    try {
      const res = await cmsService.saveDraftContent(snapshot, {
        id: user?.id,
        email: user?.email,
        role: role || undefined,
        name: user?.profile?.full_name,
      });
      if (res.success) {
        setNotification({ type: 'success', message: 'Draf landing page berhasil disimpan ke sistem.' });
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal menyimpan draf.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan saat menyimpan.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishSubmit = async () => {
    if (!snapshot) return;
    setIsPublishing(true);
    setNotification(null);
    try {
      // Auto-save draft before publishing
      await cmsService.saveDraftContent(snapshot, {
        id: user?.id,
        email: user?.email,
        role: role || undefined,
        name: user?.profile?.full_name,
      });

      const res = await cmsService.publishContent(
        {
          id: user?.id,
          email: user?.email,
          role: role || undefined,
          name: user?.profile?.full_name,
        },
        publishNotes
      );

      if (res.success) {
        setIsPublishModalOpen(false);
        setPublishNotes('');
        setNotification({
          type: 'success',
          message: `Berhasil! Versi #${res.versionNumber} telah dipublikasikan secara resmi ke Landing Page publik.`,
        });
        await loadData();
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal mempublikasikan konten.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan saat publikasi.' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackTarget) return;
    setIsRollbackLoading(true);
    try {
      const res = await cmsService.rollbackToVersion(rollbackTarget.id, {
        id: user?.id,
        email: user?.email,
        role: role || undefined,
        name: user?.profile?.full_name,
      });

      if (res.success) {
        setRollbackTarget(null);
        setNotification({
          type: 'success',
          message: `Berhasil memulihkan ke Versi #${rollbackTarget.version_number} (Versi baru #${res.restoredVersionNumber} telah dipublikasikan).`,
        });
        await loadData();
      } else {
        setNotification({ type: 'error', message: res.error || 'Gagal melakukan rollback.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsRollbackLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoError(null);
    setLogoSuccess(null);
    if (!file) return;

    // 1. Size validation (max 2 MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setLogoError(`Ukuran file logo terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Batas maksimal adalah 2 MB.`);
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    // 2. Reject SVG explicitly for security (prompt requirement 4)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setLogoError('Format file SVG ditolak demi keamanan sistem (risiko skrip berbahaya). Harap gunakan file PNG, JPG, JPEG, atau WEBP.');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    // 3. MIME validation
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      setLogoError(`Format file tidak didukung (${file.type}). Harap gunakan format gambar PNG, JPG, atau WEBP.`);
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    // 4. Create preview
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setSelectedLogoFile(file);
    setLogoPreviewUrl(preview);
  };

  const handleCancelLogo = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setSelectedLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoError(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSaveLogo = async () => {
    if (!selectedLogoFile || !snapshot) return;
    setIsUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);

    try {
      const res = await cmsService.uploadLogo(selectedLogoFile, {
        id: user?.id,
        email: user?.email,
        role: role || undefined,
        name: user?.profile?.full_name,
      });

      if (res.success && res.url) {
        setSnapshot({
          ...snapshot,
          settings: {
            ...snapshot.settings,
            logo_path: res.url,
            logo_url: res.url,
            updated_at: new Date().toISOString(),
          },
        });
        handleCancelLogo();
        setLogoSuccess('Logo berhasil diperbarui.');
      } else {
        setLogoError(res.error || 'Gagal mengunggah logo ke storage.');
      }
    } catch (e: any) {
      setLogoError(e.message || 'Terjadi kesalahan sistem saat mengunggah logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!snapshot || !confirmAction('Apakah Anda yakin ingin menghapus logo ini dan mengembalikan ke branding default pesantren?')) {
      return;
    }
    setIsUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);

    try {
      const res = await cmsService.deleteLogo({
        id: user?.id,
        email: user?.email,
        role: role || undefined,
      });

      if (res.success) {
        setSnapshot({
          ...snapshot,
          settings: {
            ...snapshot.settings,
            logo_path: undefined,
            logo_url: undefined,
            updated_at: new Date().toISOString(),
          },
        });
        handleCancelLogo();
        setLogoSuccess('Logo berhasil dihapus. Sistem akan menggunakan branding/ikon default.');
      } else {
        setLogoError(res.error || 'Gagal menghapus logo.');
      }
    } catch (e: any) {
      setLogoError(e.message || 'Terjadi kesalahan saat menghapus logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoading || !snapshot) {
    return <LoadingSpinner text="Memuat konfigurasi CMS Landing Page..." className="min-h-[70vh]" />;
  }

  const { settings, stats, requirements, steps, schedules, faqs, contacts, announcements } = snapshot;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Header Bar with Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200">
            <Layout className="w-3.5 h-3.5" /> Content Management System (CMS)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pengelolaan Konten Landing Page
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Kelola teks, statistik, persyaratan, jadwal publik, FAQ, kontak, dan SEO tanpa mengubah source code.
          </p>
        </div>

        {/* Global CMS Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Eye className="w-4 h-4 text-slate-600" />}
            onClick={() => onNavigate('/admin/landing-page/preview')}
          >
            Pratinjau Draft
          </Button>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Save className="w-4 h-4" />}
            isLoading={isSaving}
            onClick={handleSaveDraft}
          >
            Simpan Draft
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-700 hover:bg-emerald-800 font-bold shadow-md"
            leftIcon={<Send className="w-4 h-4" />}
            disabled={!canPublish}
            title={canPublish ? 'Publikasikan ke portal publik' : 'Hanya Super Admin / Pimpinan yang dapat melakukan publikasi'}
            onClick={() => {
              const val = cmsService.validateContent(snapshot);
              if (!val.isValid) {
                showToastNotification(`Validasi Konten Draf Gagal:\n\n• ${val.errors.join('\n• ')}`);
                return;
              }
              setIsPublishModalOpen(true);
            }}
          >
            Publikasikan Konten
          </Button>
        </div>
      </div>

      {/* Role permission info banner */}
      {!canPublish && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Peran Panitia:</strong> Anda dapat mengedit dan menyimpan Draf konten CMS. Otoritas penerbitan (Publish) ke portal publik dibatasi untuk SUPER_ADMIN dan PIMPINAN.
          </span>
        </div>
      )}

      {/* Notification Banner */}
      {notification && (
        <Alert
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* 2. Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs overflow-x-auto">
        <nav className="flex space-x-1 min-w-max">
          {[
            { id: 'beranda', label: '1. Beranda & Hero', icon: Layout },
            { id: 'statistik', label: '2. Statistik', icon: BarChart2 },
            { id: 'persyaratan', label: '3. Persyaratan', icon: CheckCircle },
            { id: 'alur', label: '4. Alur Seleksi', icon: ListOrdered },
            { id: 'jadwal', label: '5. Jadwal Publik', icon: Calendar },
            { id: 'faq', label: '6. FAQ', icon: HelpCircle },
            { id: 'kontak', label: '7. Kontak', icon: Phone },
            { id: 'sosmed', label: '8. Media Sosial', icon: Share2 },
            { id: 'banner', label: '9. Banner Pengumuman', icon: Megaphone },
            { id: 'seo', label: '10. SEO & Meta', icon: Globe },
            { id: 'history', label: '11. Riwayat & Rollback', icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: BERANDA & HERO */}
      {activeTab === 'beranda' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Pengaturan Identitas Lembaga & Hero Banner</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ubah teks judul utama, highlight, tahun ajaran, dan tombol ajakan bertindak (CTA).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Lembaga</label>
              <Input
                value={settings.site_name}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, site_name: e.target.value }
                })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Singkat Lembaga</label>
              <Input
                value={settings.site_short_name}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, site_short_name: e.target.value }
                })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Pelajaran (Academic Year)</label>
              <Input
                value={settings.academic_year}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, academic_year: e.target.value }
                })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Label Jenjang / Program</label>
              <Input
                value={settings.program_label}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, program_label: e.target.value }
                })}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Teks Hero Utama</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hero Badge (Pill di atas judul)</label>
                <Input
                  value={settings.hero_badge}
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, hero_badge: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Hero (Baris 1)</label>
                <Input
                  value={settings.hero_title}
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, hero_title: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Highlight Teks (Warna Hijau)</label>
                <Input
                  value={settings.hero_highlight}
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, hero_highlight: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub Judul Tambahan (Opsional)</label>
                <Input
                  value={settings.hero_subtitle || ''}
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, hero_subtitle: e.target.value }
                  })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Narasi Hero</label>
              <textarea
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={settings.hero_description}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, hero_description: e.target.value }
                })}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tombol Ajakan Bertindak (CTA)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-xs text-slate-800 block">Tombol Utama (Primary)</span>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Teks Tombol</label>
                  <Input
                    value={settings.hero_primary_button_text}
                    onChange={e => setSnapshot({
                      ...snapshot,
                      settings: { ...settings, hero_primary_button_text: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Tautan Tujuan (Link)</label>
                  <Input
                    value={settings.hero_primary_button_link}
                    onChange={e => setSnapshot({
                      ...snapshot,
                      settings: { ...settings, hero_primary_button_link: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-xs text-slate-800 block">Tombol Sekunder (Secondary)</span>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Teks Tombol</label>
                  <Input
                    value={settings.hero_secondary_button_text}
                    onChange={e => setSnapshot({
                      ...snapshot,
                      settings: { ...settings, hero_secondary_button_text: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Tautan Tujuan (Link)</label>
                  <Input
                    value={settings.hero_secondary_button_link}
                    onChange={e => setSnapshot({
                      ...snapshot,
                      settings: { ...settings, hero_secondary_button_link: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: LOGO WEBSITE */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                  Logo Website
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Logo utama pondok pesantren yang ditampilkan pada header dan hero landing page.
                </p>
              </div>

              {/* Guidelines Badge */}
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>PNG, JPG, WEBP • Maks. 2 MB • SVG ditolak</span>
              </div>
            </div>

            {/* Error Message */}
            {logoError && (
              <Alert
                type="error"
                title="Gagal Mengunggah Logo"
                message={logoError}
                onClose={() => setLogoError(null)}
              />
            )}

            {/* Success Message */}
            {logoSuccess && (
              <Alert
                type="success"
                title="Berhasil"
                message={logoSuccess}
                onClose={() => setLogoSuccess(null)}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              {/* Box 1: Logo Saat Ini */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Logo Saat Ini
                </span>

                <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center gap-4 min-h-[110px]">
                  {settings.logo_path || settings.logo_url ? (
                    <>
                      <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-xs">
                        <img
                          src={getLogoUrlWithCacheBust(settings.logo_path || settings.logo_url, settings.updated_at)}
                          alt="Logo Saat Ini"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" /> Aktif di Draft
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Diperbarui: {new Date(settings.updated_at).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium truncate">
                          {settings.site_short_name || 'Logo PPTQM Darul Hikmah'}
                        </p>
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-[11px] py-1 h-auto"
                            leftIcon={<Trash2 className="w-3 h-3" />}
                            disabled={isUploadingLogo}
                            onClick={handleDeleteLogo}
                          >
                            Hapus Logo (Reset Default)
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-400 py-2">
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 shrink-0">
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-600">Belum ada logo</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Portal menggunakan ikon bawaan (default branding). Unggah logo resmi untuk memperbarui tampilan.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Upload & Preview File yang Dipilih */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  {selectedLogoFile ? 'Pratinjau File yang Dipilih' : 'Unggah Logo Baru'}
                </span>

                {selectedLogoFile && logoPreviewUrl ? (
                  <div className="p-4 bg-emerald-50/50 rounded-xl border-2 border-emerald-300 flex flex-col sm:flex-row items-center gap-4 min-h-[110px]">
                    <div className="w-20 h-20 rounded-xl bg-white border border-emerald-200 flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-xs">
                      <img
                        src={logoPreviewUrl}
                        alt="Preview Logo Baru"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-2 flex-1 w-full text-center sm:text-left">
                      <div>
                        <p className="text-xs font-bold text-emerald-950 truncate">
                          {selectedLogoFile.name}
                        </p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          Ukuran: {(selectedLogoFile.size / 1024).toFixed(1)} KB • Tipe: {selectedLogoFile.type}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="primary"
                          className="bg-emerald-700 hover:bg-emerald-800 font-bold text-xs"
                          isLoading={isUploadingLogo}
                          leftIcon={<Save className="w-3.5 h-3.5" />}
                          onClick={handleSaveLogo}
                        >
                          Simpan Logo
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={isUploadingLogo}
                          onClick={handleCancelLogo}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-2 min-h-[110px]">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700">
                        Pilih file logo untuk diunggah
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Format PNG, JPG, atau WEBP (Maksimal 2 MB)
                      </p>
                    </div>

                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />

                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-700 hover:bg-emerald-800 font-bold text-xs mt-1"
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Upload Logo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION: CALL TO ACTION (CTA) BAWAH HALAMAN */}
          <div className="pt-6 border-t border-slate-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-700" />
                  Bagian Call-To-Action (CTA) Bawah Halaman
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur teks ajakan, tombol utama (kiri / putih), dan tombol sekunder (kanan / hubungi panitia) pada banner hijau bagian bawah landing page.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Banner CTA Bawah <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={settings.cta_title || ''}
                  placeholder="Siap Menjadi Bagian dari Keluarga Besar PPTQM Darul Hikmah?"
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, cta_title: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi / Narasi CTA Bawah
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  value={settings.cta_description || ''}
                  placeholder="Daftarkan putra/putri Anda sekarang sebelum kuota 120 santri baru terpenuhi. Proses pendaftaran mudah, transparan, dan dapat dipantau langsung secara online."
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, cta_description: e.target.value }
                  })}
                />
              </div>

              {/* Grid 2 Tombol */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Tombol Utama (Kiri / Putih) */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                      Tombol Utama (Kiri / Tombol Putih)
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={settings.cta_primary_button_active !== false}
                        onChange={e => setSnapshot({
                          ...snapshot,
                          settings: { ...settings, cta_primary_button_active: e.target.checked }
                        })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      Aktif
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Teks Tombol <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={settings.cta_primary_button_text || ''}
                      placeholder="Daftar Sekarang"
                      onChange={e => setSnapshot({
                        ...snapshot,
                        settings: { ...settings, cta_primary_button_text: e.target.value }
                      })}
                    />
                    {!settings.cta_primary_button_text?.trim() && settings.cta_primary_button_active !== false && (
                      <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                        * Text tombol wajib diisi.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Tautan Tujuan (Link Route/URL) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={settings.cta_primary_button_link || ''}
                      placeholder="/register"
                      onChange={e => setSnapshot({
                        ...snapshot,
                        settings: { ...settings, cta_primary_button_link: e.target.value }
                      })}
                    />
                  </div>
                </div>

                {/* Tombol Sekunder (Kanan / Hubungi Panitia) */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 inline-block border border-emerald-400" />
                      Tombol Sekunder (Kanan / Outline Hijau)
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={settings.cta_secondary_button_active !== false}
                        onChange={e => setSnapshot({
                          ...snapshot,
                          settings: { ...settings, cta_secondary_button_active: e.target.checked }
                        })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      Aktif
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Teks Tombol <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={settings.cta_secondary_button_text || ''}
                      placeholder="Hubungi Panitia"
                      onChange={e => setSnapshot({
                        ...snapshot,
                        settings: { ...settings, cta_secondary_button_text: e.target.value }
                      })}
                    />
                    {!settings.cta_secondary_button_text?.trim() && settings.cta_secondary_button_active !== false && (
                      <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                        * Text tombol wajib diisi.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Tautan Custom (Kosongkan untuk otomatis menggunakan nomor WhatsApp Panitia)
                    </label>
                    <Input
                      value={settings.cta_secondary_button_link || ''}
                      placeholder="https://wa.me/6281234567890 (Opsional)"
                      onChange={e => setSnapshot({
                        ...snapshot,
                        settings: { ...settings, cta_secondary_button_link: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Pratinjau Tampilan CTA Bawah */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-700 block mb-2 uppercase tracking-wider">
                  Pratinjau Tampilan CTA Bawah
                </span>
                <div className="p-6 rounded-2xl bg-emerald-800 text-white text-center space-y-4 shadow-sm border border-emerald-700">
                  <h5 className="text-lg font-extrabold text-white">
                    {settings.cta_title || `Siap Menjadi Bagian dari Keluarga Besar ${settings.site_short_name || 'PPTQM Darul Hikmah'}?`}
                  </h5>
                  <p className="text-xs text-emerald-100 max-w-xl mx-auto leading-relaxed">
                    {settings.cta_description || 'Daftarkan putra/putri Anda sekarang sebelum kuota 120 santri baru terpenuhi.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {settings.cta_primary_button_active !== false && (
                      <div className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-white text-emerald-950 font-extrabold text-xs shadow-md border border-white">
                        <span>{settings.cta_primary_button_text || 'Daftar Sekarang'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-950" />
                      </div>
                    )}
                    {settings.cta_secondary_button_active !== false && (
                      <div className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border-2 border-emerald-400 text-white font-bold text-xs bg-emerald-700/50">
                        <Phone className="w-3.5 h-3.5 text-white" />
                        <span>{settings.cta_secondary_button_text || 'Hubungi Panitia (+62 812-3456-7890)'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STATISTIK */}
      {activeTab === 'statistik' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Kartu Angka Statistik Hero</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar angka pencapaian, kuota santri, dan keunggulan yang tampil di bawah hero section.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingStat({
                  id: 'stat-' + Date.now(),
                  label: '',
                  value: '',
                  description: '',
                  icon_key: 'Award',
                  sort_order: stats.length + 1,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                setIsStatModalOpen(true);
              }}
            >
              Tambah Statistik
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(st => (
              <div
                key={st.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                  st.is_active ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      Urutan #{st.sort_order}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${st.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {st.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-800 mb-1">{st.value}</div>
                  <div className="text-xs font-bold text-slate-800">{st.label}</div>
                  {st.description && <p className="text-[11px] text-slate-500 mt-1">{st.description}</p>}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingStat(st);
                      setIsStatModalOpen(true);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction(`Hapus statistik "${st.label}"?`)) {
                        setSnapshot({
                          ...snapshot,
                          stats: stats.filter(s => s.id !== st.id),
                        });
                      }
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PERSYARATAN */}
      {activeTab === 'persyaratan' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daftar Persyaratan Pendaftaran</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola butir persyaratan umum dan kelengkapan dokumen administrasi santri baru.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingReq({
                  id: 'req-' + Date.now(),
                  category: 'UMUM',
                  title: '',
                  description: '',
                  icon_key: 'CheckCircle',
                  sort_order: requirements.length + 1,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                setIsReqModalOpen(true);
              }}
            >
              Tambah Persyaratan
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Umum */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Kategori 1: Persyaratan Umum & Kesiapan
              </h4>
              <div className="space-y-2.5">
                {requirements.filter(r => r.category === 'UMUM').map(r => (
                  <div key={r.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-bold text-slate-900 block">{r.title}</span>
                      <p className="text-slate-600 mt-0.5">{r.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingReq(r);
                          setIsReqModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmAction('Hapus persyaratan ini?')) {
                            setSnapshot({
                              ...snapshot,
                              requirements: requirements.filter(x => x.id !== r.id),
                            });
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Berkas */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4" /> Kategori 2: Data & Berkas Administrasi
              </h4>
              <div className="space-y-2.5">
                {requirements.filter(r => r.category === 'BERKAS').map(r => (
                  <div key={r.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-bold text-slate-900 block">{r.title}</span>
                      <p className="text-slate-600 mt-0.5">{r.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingReq(r);
                          setIsReqModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmAction('Hapus persyaratan berkas ini?')) {
                            setSnapshot({
                              ...snapshot,
                              requirements: requirements.filter(x => x.id !== r.id),
                            });
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALUR SELEKSI */}
      {activeTab === 'alur' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Alur & Tahapan Pendaftaran Santri</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Langkah-langkah yang memandu calon wali santri mulai dari registrasi hingga pengumuman seleksi.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingStep({
                  id: 'step-' + Date.now(),
                  step_number: String(steps.length + 1).padStart(2, '0'),
                  title: '',
                  description: '',
                  icon_key: 'CheckCircle',
                  sort_order: steps.length + 1,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                setIsStepModalOpen(true);
              }}
            >
              Tambah Alur Langkah
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map(step => (
              <div key={step.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-black text-emerald-700">{step.step_number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${step.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {step.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 mb-1">{step.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{step.description}</p>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setEditingStep(step);
                      setIsStepModalOpen(true);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction(`Hapus tahapan "${step.title}"?`)) {
                        setSnapshot({
                          ...snapshot,
                          steps: steps.filter(s => s.id !== step.id),
                        });
                      }
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: JADWAL PUBLIK */}
      {activeTab === 'jadwal' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Agenda Jadwal Publik Seleksi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Jadwal yang ditampilkan secara transparan di Landing Page tanpa membocorkan data internal panitia.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingSchedule({
                  id: 'sch-' + Date.now(),
                  title: '',
                  description: '',
                  event_date_text: '',
                  badge_color: 'emerald',
                  is_public: true,
                  sort_order: schedules.length + 1,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                setIsScheduleModalOpen(true);
              }}
            >
              Tambah Jadwal Publik
            </Button>
          </div>

          <div className="space-y-3">
            {schedules.map(sch => (
              <div key={sch.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-300 transition">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-900">{sch.title}</h4>
                      {!sch.is_public && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-semibold">
                          Internal (Disembunyikan)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{sch.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    {sch.event_date_text}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSchedule(sch);
                        setIsScheduleModalOpen(true);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirmAction(`Hapus jadwal "${sch.title}"?`)) {
                          setSnapshot({
                            ...snapshot,
                            schedules: schedules.filter(s => s.id !== sch.id),
                          });
                        }
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: FAQ */}
      {activeTab === 'faq' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Tanya Jawab (FAQ)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola daftar pertanyaan yang sering diajukan dan tampil sebagai accordion di landing page.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingFaq({
                  id: 'faq-' + Date.now(),
                  question: '',
                  answer: '',
                  sort_order: faqs.length + 1,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                setIsFaqModalOpen(true);
              }}
            >
              Tambah FAQ
            </Button>
          </div>

          <div className="space-y-3">
            {faqs.map(faq => (
              <div key={faq.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                      #{faq.sort_order}
                    </span>
                    <h4 className="font-bold text-xs text-slate-900">{faq.question}</h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingFaq(faq);
                        setIsFaqModalOpen(true);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirmAction('Hapus butir FAQ ini?')) {
                          setSnapshot({
                            ...snapshot,
                            faqs: faqs.filter(f => f.id !== faq.id),
                          });
                        }
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 pl-8 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: KONTAK & PANITIA */}
      {activeTab === 'kontak' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Saluran Kontak Resmi Panitia</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola nomor WhatsApp, email, dan alamat yang terhubung langsung dengan tombol bantuan landing page.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingContact({
                  id: 'contact-' + Date.now(),
                  contact_type: 'WHATSAPP',
                  label: '',
                  value: '',
                  link: '',
                  icon_key: 'Phone',
                  sort_order: contacts.length + 1,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                setIsContactModalOpen(true);
              }}
            >
              Tambah Kontak
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map(c => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {c.contact_type}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">{c.label}</h4>
                  <div className="text-xs text-slate-600 font-mono mt-1">{c.value}</div>
                  {c.link && (
                    <div className="text-[11px] text-emerald-700 truncate mt-1">
                      {c.link}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingContact(c);
                      setIsContactModalOpen(true);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction(`Hapus kontak "${c.label}"?`)) {
                        setSnapshot({
                          ...snapshot,
                          contacts: contacts.filter(x => x.id !== c.id),
                        });
                      }
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: MEDIA SOSIAL */}
      {activeTab === 'sosmed' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Tautan Akun Media Sosial Resmi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tautan ke akun Instagram, YouTube, Facebook, TikTok, dan kanal resmi pesantren.
            </p>
          </div>

          <div className="space-y-4 max-w-2xl">
            {['INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'TIKTOK'].map(type => {
              const existing = contacts.find(c => c.contact_type === type);
              return (
                <div key={type} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="w-32">
                    <span className="font-bold text-xs text-slate-800 block">{type}</span>
                    <span className="text-[10px] text-slate-500">Tautan profil</span>
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder={`https://${type.toLowerCase()}.com/...`}
                      value={existing?.link || ''}
                      onChange={e => {
                        const val = e.target.value;
                        let updated = [...contacts];
                        const idx = updated.findIndex(c => c.contact_type === type);
                        if (idx >= 0) {
                          updated[idx] = {
                            ...updated[idx],
                            link: val,
                            value: val,
                            is_active: !!val.trim(),
                          };
                        } else {
                          updated.push({
                            id: 'contact-' + type.toLowerCase(),
                            contact_type: type as any,
                            label: `Akun ${type}`,
                            value: val,
                            link: val,
                            icon_key: type === 'INSTAGRAM' ? 'Instagram' : 'Globe',
                            sort_order: contacts.length + 1,
                            is_active: !!val.trim(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          });
                        }
                        setSnapshot({ ...snapshot, contacts: updated });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 9: BANNER PENGUMUMAN */}
      {activeTab === 'banner' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Banner Pengumuman Atas (Top Banner)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Banner darurat atau informasi pembukaan gelombang yang hanya muncul saat berstatus aktif dan dalam rentang tanggal.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl">
            {announcements.map((ann, idx) => (
              <div key={ann.id || idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-xs text-slate-800">Banner Pengumuman #{idx + 1}</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-slate-600 font-medium">Tampilkan Banner:</span>
                    <input
                      type="checkbox"
                      checked={ann.is_active}
                      onChange={e => {
                        const updated = [...announcements];
                        updated[idx].is_active = e.target.checked;
                        setSnapshot({ ...snapshot, announcements: updated });
                      }}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Judul Pengumuman</label>
                    <Input
                      value={ann.title}
                      onChange={e => {
                        const updated = [...announcements];
                        updated[idx].title = e.target.value;
                        setSnapshot({ ...snapshot, announcements: updated });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Teks Tombol Aksi</label>
                    <Input
                      value={ann.button_text || ''}
                      onChange={e => {
                        const updated = [...announcements];
                        updated[idx].button_text = e.target.value;
                        setSnapshot({ ...snapshot, announcements: updated });
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Isi Konten Pengumuman</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    value={ann.content}
                    onChange={e => {
                      const updated = [...announcements];
                      updated[idx].content = e.target.value;
                      setSnapshot({ ...snapshot, announcements: updated });
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Mulai Tampil</label>
                    <Input
                      type="date"
                      value={ann.start_at ? ann.start_at.substring(0, 10) : ''}
                      onChange={e => {
                        const updated = [...announcements];
                        updated[idx].start_at = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                        setSnapshot({ ...snapshot, announcements: updated });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Selesai Tampil</label>
                    <Input
                      type="date"
                      value={ann.end_at ? ann.end_at.substring(0, 10) : ''}
                      onChange={e => {
                        const updated = [...announcements];
                        updated[idx].end_at = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                        setSnapshot({ ...snapshot, announcements: updated });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: SEO & META */}
      {activeTab === 'seo' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Optimasi Mesin Pencari (SEO) & OpenGraph Share Card</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur judul dan deskripsi pencarian Google serta thumbnail preview saat link dibagikan di WhatsApp dan Facebook.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Meta Title Tag (Tab Browser)</label>
              <Input
                value={settings.meta_title || ''}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, meta_title: e.target.value }
                })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Direkomendasikan antara 50 - 60 karakter.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Meta Description</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={settings.meta_description || ''}
                onChange={e => setSnapshot({
                  ...snapshot,
                  settings: { ...settings, meta_description: e.target.value }
                })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Direkomendasikan antara 120 - 160 karakter.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">OpenGraph Title (WhatsApp / Sosmed)</label>
                <Input
                  value={settings.og_title || ''}
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, og_title: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">OpenGraph Image URL</label>
                <Input
                  value={settings.og_image || ''}
                  onChange={e => setSnapshot({
                    ...snapshot,
                    settings: { ...settings, og_image: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: RIWAYAT VERSI & ROLLBACK */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Riwayat Versi Publikasi & Pemulihan (Rollback)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap kali Anda menekan 'Publish', snapshot lengkap disimpan. Super Admin dapat memulihkan ke versi terdahulu kapan saja tanpa merusak riwayat log.
            </p>
          </div>

          <div className="space-y-3">
            {versions.map(v => (
              <div
                key={v.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  v.status === 'PUBLISHED'
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-sm text-slate-900">
                      Versi #{v.version_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        v.status === 'PUBLISHED'
                          ? 'bg-emerald-600 text-white'
                          : v.status === 'ARCHIVED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">{v.notes || 'Publikasi konten rutin'}</p>
                  <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-3">
                    <span>Dibuat: {new Date(v.created_at).toLocaleString('id-ID')}</span>
                    {v.published_by_name && <span>Oleh: {v.published_by_name}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {v.status === 'PUBLISHED' ? (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4 text-emerald-600" /> Sedang Aktif di Publik
                    </span>
                  ) : (
                    isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-bold border-amber-300 text-amber-900 hover:bg-amber-50"
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
                        onClick={() => setRollbackTarget(v)}
                      >
                        Pulihkan Versi Ini
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MODALS */}

      {/* PUBLISH CONFIRMATION MODAL */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Konfirmasi Publikasi Konten Landing Page"
        subtitle="Draf yang Anda simpan akan segera tampil ke seluruh pengunjung portal publik"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button size="sm" variant="outline" onClick={() => setIsPublishModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 font-bold"
              isLoading={isPublishing}
              onClick={handlePublishSubmit}
            >
              Ya, Publikasikan Sekarang
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1.5">
            <span className="font-bold text-sm text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Siap Diterbitkan
            </span>
            <p className="leading-relaxed">
              Seluruh data pada draf saat ini akan dibekukan menjadi snapshot versi baru. Cache publik akan langsung diperbarui.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Rilis / Publikasi (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Pembaruan jadwal gelombang 1 dan nomor WA hotline..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              value={publishNotes}
              onChange={e => setPublishNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ROLLBACK CONFIRMATION MODAL */}
      <Modal
        isOpen={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        title="Konfirmasi Pemulihan Versi (Rollback)"
        subtitle="Pulihkan tampilan landing page ke snapshot versi terdahulu"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button size="sm" variant="outline" onClick={() => setRollbackTarget(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              isLoading={isRollbackLoading}
              onClick={handleRollbackConfirm}
            >
              Pulihkan Snapshot Ini
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-700 leading-relaxed">
            Anda akan memulihkan landing page ke <strong>Versi #{rollbackTarget?.version_number}</strong> ({rollbackTarget?.notes || 'Snapshot arsip'}).
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
            <strong>Catatan Keamanan:</strong> Riwayat riil versi tidak dihapus. Sistem akan menerbitkan versi baru dengan nomor versi tertinggi berdasarkan data snapshot lama ini.
          </div>
        </div>
      </Modal>

      {/* STATISTIC EDIT MODAL */}
      <Modal
        isOpen={isStatModalOpen}
        onClose={() => setIsStatModalOpen(false)}
        title={editingStat?.label ? 'Edit Statistik' : 'Tambah Statistik Baru'}
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setIsStatModalOpen(false)}>Batal</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (!editingStat) return;
                let updated = [...stats];
                const idx = updated.findIndex(s => s.id === editingStat.id);
                if (idx >= 0) {
                  updated[idx] = editingStat;
                } else {
                  updated.push(editingStat);
                }
                setSnapshot({ ...snapshot, stats: updated });
                setIsStatModalOpen(false);
              }}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editingStat && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nilai / Angka (Value)</label>
              <Input
                placeholder="Contoh: 120 / 30 Juz / A"
                value={editingStat.value}
                onChange={e => setEditingStat({ ...editingStat, value: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Label Statistik</label>
              <Input
                placeholder="Contoh: Kuota Santri Baru"
                value={editingStat.label}
                onChange={e => setEditingStat({ ...editingStat, label: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Deskripsi Singkat</label>
              <Input
                placeholder="Contoh: Terbagi 2 kelas putra dan 2 putri"
                value={editingStat.description || ''}
                onChange={e => setEditingStat({ ...editingStat, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Urutan (Sort Order)</label>
                <Input
                  type="number"
                  value={editingStat.sort_order}
                  onChange={e => setEditingStat({ ...editingStat, sort_order: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStat.is_active}
                    onChange={e => setEditingStat({ ...editingStat, is_active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="font-bold text-slate-700">Status Aktif</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* REQUIREMENTS EDIT MODAL */}
      <Modal
        isOpen={isReqModalOpen}
        onClose={() => setIsReqModalOpen(false)}
        title="Edit Persyaratan Pendaftaran"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setIsReqModalOpen(false)}>Batal</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (!editingReq) return;
                let updated = [...requirements];
                const idx = updated.findIndex(r => r.id === editingReq.id);
                if (idx >= 0) {
                  updated[idx] = editingReq;
                } else {
                  updated.push(editingReq);
                }
                setSnapshot({ ...snapshot, requirements: updated });
                setIsReqModalOpen(false);
              }}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editingReq && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Kategori Persyaratan</label>
              <Select
                value={editingReq.category}
                onChange={e => setEditingReq({ ...editingReq, category: e.target.value as any })}
                options={[
                  { value: 'UMUM', label: 'Persyaratan Umum & Kesiapan Santri' },
                  { value: 'BERKAS', label: 'Data & Berkas Dokumen Administrasi' },
                ]}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Ringkas</label>
              <Input
                placeholder="Contoh: Siswa Kelas 6 SD/MI"
                value={editingReq.title}
                onChange={e => setEditingReq({ ...editingReq, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Deskripsi Lengkap Persyaratan</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={editingReq.description}
                onChange={e => setEditingReq({ ...editingReq, description: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* STEP EDIT MODAL */}
      <Modal
        isOpen={isStepModalOpen}
        onClose={() => setIsStepModalOpen(false)}
        title="Edit Alur Langkah Pendaftaran"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setIsStepModalOpen(false)}>Batal</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (!editingStep) return;
                let updated = [...steps];
                const idx = updated.findIndex(s => s.id === editingStep.id);
                if (idx >= 0) {
                  updated[idx] = editingStep;
                } else {
                  updated.push(editingStep);
                }
                setSnapshot({ ...snapshot, steps: updated });
                setIsStepModalOpen(false);
              }}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editingStep && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Langkah</label>
                <Input
                  placeholder="01"
                  value={editingStep.step_number}
                  onChange={e => setEditingStep({ ...editingStep, step_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Urutan (Sort Order)</label>
                <Input
                  type="number"
                  value={editingStep.sort_order}
                  onChange={e => setEditingStep({ ...editingStep, sort_order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Langkah</label>
              <Input
                placeholder="Daftar Akun"
                value={editingStep.title}
                onChange={e => setEditingStep({ ...editingStep, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Penjelasan Singkat</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={editingStep.description}
                onChange={e => setEditingStep({ ...editingStep, description: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* SCHEDULE EDIT MODAL */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Edit Agenda Jadwal Publik"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setIsScheduleModalOpen(false)}>Batal</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (!editingSchedule) return;
                let updated = [...schedules];
                const idx = updated.findIndex(s => s.id === editingSchedule.id);
                if (idx >= 0) {
                  updated[idx] = editingSchedule;
                } else {
                  updated.push(editingSchedule);
                }
                setSnapshot({ ...snapshot, schedules: updated });
                setIsScheduleModalOpen(false);
              }}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editingSchedule && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Kegiatan</label>
              <Input
                placeholder="Pendaftaran Online & Pengisian Biodata"
                value={editingSchedule.title}
                onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Deskripsi Singkat</label>
              <Input
                placeholder="Pengisian formulir santri baru secara online"
                value={editingSchedule.description}
                onChange={e => setEditingSchedule({ ...editingSchedule, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Teks Tanggal Pelaksanaan</label>
              <Input
                placeholder="Contoh: 1 Oktober - 31 Desember 2026 / 10 Januari 2027"
                value={editingSchedule.event_date_text}
                onChange={e => setEditingSchedule({ ...editingSchedule, event_date_text: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingSchedule.is_public}
                  onChange={e => setEditingSchedule({ ...editingSchedule, is_public: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-bold text-slate-700">Tampilkan di Publik</span>
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* FAQ EDIT MODAL */}
      <Modal
        isOpen={isFaqModalOpen}
        onClose={() => setIsFaqModalOpen(false)}
        title="Edit FAQ"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setIsFaqModalOpen(false)}>Batal</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (!editingFaq) return;
                let updated = [...faqs];
                const idx = updated.findIndex(f => f.id === editingFaq.id);
                if (idx >= 0) {
                  updated[idx] = editingFaq;
                } else {
                  updated.push(editingFaq);
                }
                setSnapshot({ ...snapshot, faqs: updated });
                setIsFaqModalOpen(false);
              }}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editingFaq && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pertanyaan (Question)</label>
              <Input
                value={editingFaq.question}
                onChange={e => setEditingFaq({ ...editingFaq, question: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jawaban (Answer)</label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={editingFaq.answer}
                onChange={e => setEditingFaq({ ...editingFaq, answer: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* CONTACT EDIT MODAL */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title="Edit Saluran Kontak"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setIsContactModalOpen(false)}>Batal</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (!editingContact) return;
                let updated = [...contacts];
                const idx = updated.findIndex(c => c.id === editingContact.id);
                if (idx >= 0) {
                  updated[idx] = editingContact;
                } else {
                  updated.push(editingContact);
                }
                setSnapshot({ ...snapshot, contacts: updated });
                setIsContactModalOpen(false);
              }}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editingContact && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipe Kontak</label>
              <Select
                value={editingContact.contact_type}
                onChange={e => setEditingContact({ ...editingContact, contact_type: e.target.value as any })}
                options={[
                  { value: 'WHATSAPP', label: 'WhatsApp' },
                  { value: 'EMAIL', label: 'Email' },
                  { value: 'WEBSITE', label: 'Website' },
                  { value: 'ALAMAT', label: 'Alamat Kampus' },
                  { value: 'INSTAGRAM', label: 'Instagram' },
                ]}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Label Tampilan</label>
              <Input
                placeholder="WhatsApp Helpdesk Panitia"
                value={editingContact.label}
                onChange={e => setEditingContact({ ...editingContact, label: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nilai / Nomor / Teks</label>
              <Input
                placeholder="+62 812-3456-7890"
                value={editingContact.value}
                onChange={e => setEditingContact({ ...editingContact, value: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tautan Langsung (URL / wa.me)</label>
              <Input
                placeholder="https://wa.me/6281234567890"
                value={editingContact.link || ''}
                onChange={e => setEditingContact({ ...editingContact, link: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
