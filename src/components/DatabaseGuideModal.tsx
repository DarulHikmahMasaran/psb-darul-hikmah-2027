import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Alert } from './Alert';
import {
  isSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
  saveRuntimeSupabaseConfig,
  clearRuntimeSupabaseConfig,
  getGasWebhookUrl,
  saveGasWebhookUrl
} from '../lib/supabase';
import {
  getStorageData,
  saveStorageData,
  exportStorageDataJson,
  importStorageDataJson,
  resetStorageToDefault
} from '../lib/storage';
import {
  Database,
  Check,
  Copy,
  Shield,
  Code,
  FolderLock,
  UserCheck,
  ExternalLink,
  ShieldAlert,
  Terminal,
  FileCheck,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  Globe,
  CheckCircle2
} from 'lucide-react';

export const DatabaseGuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'free_publish' | 'status' | 'editor' | 'migration' | 'storage' | 'admin'>('free_publish');
  const [selectedMigration, setSelectedMigration] = useState<'001' | '002' | '003' | '004' | '005' | '006' | '007' | '008' | '009' | '010'>('001');
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedStorageSql, setCopiedStorageSql] = useState(false);
  const [copiedAdminSql, setCopiedAdminSql] = useState(false);
  const [copiedGasScript, setCopiedGasScript] = useState(false);
  const [copiedAllInOneSql, setCopiedAllInOneSql] = useState(false);
  const [publicDemoMode, setPublicDemoMode] = useState<boolean>(() => {
    const st = getStorageData().settings?.find(s => s.key === 'public_demo_controls');
    return (st?.value ?? 'true') !== 'false';
  });

  const handleTogglePublicDemoMode = (enableDemo: boolean) => {
    const data = getStorageData();
    const existing = data.settings.find(s => s.key === 'public_demo_controls');
    if (existing) existing.value = enableDemo ? 'true' : 'false';
    else data.settings.push({ id: '18', key: 'public_demo_controls', value: enableDemo ? 'true' : 'false', updated_at: new Date().toISOString() });
    saveStorageData(data);
    setPublicDemoMode(enableDemo);
    setStatusMessage({
      type: 'success',
      text: enableDemo
        ? 'Mode Evaluasi / Simulasi Rapat DIAKTIFKAN: Tombol Uji Role & Akun Cepat tampil untuk memudahkan pengujian.'
        : 'Mode Produksi Resmi DIAKTIFKAN: Tombol Uji Role & Demo disembunyikan dari publik/calon santri (hanya tampil bagi Super Admin/Panitia).'
    });
  };

  const [runtimeUrl, setRuntimeUrl] = useState(() => getSupabaseUrl());
  const [runtimeKey, setRuntimeKey] = useState(() => getSupabaseAnonKey());
  const [gasUrl, setGasUrl] = useState(() => getGasWebhookUrl());
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'warning' | 'error'; text: string } | null>(null);
  const [isSyncingGas, setIsSyncingGas] = useState(false);

  const isConnected = isSupabaseConfigured();
  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_ANON_KEY = getSupabaseAnonKey();
  const localStats = getStorageData();

  const gasAppsScriptCode = `// Google Apps Script (100% Gratis Tanpa Billing) untuk PSB PPTQM Darul Hikmah
// Cara Pakai: Buka script.google.com -> Buat Proyek Baru -> Tempel kode ini -> Deploy sebagai Web App (Anyone)
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Pendaftar_PSB") || ss.insertSheet("Pendaftar_PSB");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Waktu Sync", "No Registrasi", "Nama Lengkap", "NIK", "NISN", "JK", "Sekolah Asal", "No WA Wali", "Status"]);
    }
    var candidates = payload.candidates || [];
    sheet.clearContents();
    sheet.appendRow(["Waktu Sync", "No Registrasi", "Nama Lengkap", "NIK", "NISN", "JK", "Sekolah Asal", "No WA Wali", "Status"]);
    var now = new Date().toISOString();
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      sheet.appendRow([now, c.registration_number || "", c.full_name || "", c.nik || "", c.nisn || "", c.gender || "", c.school_name || "", c.guardian_phone || "", c.status || ""]);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", synced: candidates.length })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleSaveRuntimeSupabase = () => {
    saveRuntimeSupabaseConfig(runtimeUrl, runtimeKey);
    setStatusMessage({
      type: 'success',
      text: runtimeUrl && runtimeKey
        ? 'Konfigurasi Supabase Free Tier berhasil disimpan di browser! Muat ulang halaman jika ingin menyegarkan klien.'
        : 'Koneksi Supabase dikosongkan. Aplikasi berjalan menggunakan Mesin Database Lokal Mandiri (100% Gratis).'
    });
  };

  const handleClearRuntimeSupabase = () => {
    clearRuntimeSupabaseConfig();
    setRuntimeUrl('');
    setRuntimeKey('');
    setStatusMessage({
      type: 'info',
      text: 'Kembali ke Mode Database Lokal Mandiri (Zero-Billing). Seluruh fitur tetap berjalan penuh!'
    });
  };

  const handleExportJson = () => {
    try {
      const jsonStr = exportStorageDataJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_psb_darul_hikmah_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'File backup JSON database berhasil diunduh ke perangkat Anda.' });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Gagal mengekspor JSON: ' + (e?.message || '') });
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      const res = importStorageDataJson(content);
      setStatusMessage({ type: res.success ? 'success' : 'error', text: res.message });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaultData = () => {
    resetStorageToDefault();
    setStatusMessage({
      type: 'info',
      text: 'Database lokal telah dikembalikan ke data awal (seed default PSB PPTQM Darul Hikmah).'
    });
  };

  const handleSyncToGoogleSheets = async () => {
    saveGasWebhookUrl(gasUrl);
    if (!gasUrl.trim()) {
      setStatusMessage({ type: 'warning', text: 'Masukkan URL Web App Google Apps Script terlebih dahulu.' });
      return;
    }
    setIsSyncingGas(true);
    try {
      const data = getStorageData();
      await fetch(gasUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          candidates: data.candidates,
          profiles: data.profiles
        })
      });
      setStatusMessage({
        type: 'success',
        text: `Berhasil mengirim ${data.candidates.length} data calon santri ke Google Sheets Webhook Anda!`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal menghubungi URL Google Apps Script: ' + (err?.message || 'Periksa koneksi internet.')
      });
    } finally {
      setIsSyncingGas(false);
    }
  };

  const fullSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 001: Initial Schema, Security Hardening, RLS & Trigger
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN', 'PESERTA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE candidate_status AS ENUM (
        'DRAFT', 'TERDAFTAR', 'PERLU_PERBAIKAN', 'TERVERIFIKASI',
        'DIIZINKAN_MENGIKUTI_SELEKSI', 'MENGIKUTI_SELEKSI', 'SELESAI_SELEKSI',
        'LULUS', 'CADANGAN', 'TIDAK_LULUS', 'DAFTAR_ULANG', 'DITERIMA_FINAL', 'BATAL'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'PESERTA',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_profiles_user_id UNIQUE (user_id),
    CONSTRAINT uq_profiles_email UNIQUE (email)
);

-- 2. CANDIDATES
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    registration_number VARCHAR(30) NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    nik VARCHAR(20),
    nisn VARCHAR(20),
    birth_place TEXT,
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('L', 'P')),
    religion VARCHAR(20) DEFAULT 'Islam',
    school_name TEXT,
    school_npsn VARCHAR(20),
    school_nis VARCHAR(20),
    address TEXT,
    village TEXT,
    district TEXT,
    regency TEXT,
    province TEXT,
    postal_code VARCHAR(10),
    father_name TEXT,
    father_nik VARCHAR(20),
    father_occupation TEXT,
    mother_name TEXT,
    mother_nik VARCHAR(20),
    mother_occupation TEXT,
    guardian_name TEXT,
    guardian_relationship TEXT,
    guardian_phone VARCHAR(25),
    guardian_address TEXT,
    child_order INTEGER,
    sibling_count INTEGER,
    living_status TEXT,
    status candidate_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_candidates_user_id UNIQUE (user_id)
);

-- 3. CANDIDATE STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.candidate_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    old_status candidate_status,
    new_status candidate_status NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. SEQUENCE REGISTRATION NUMBER (DH-2027-0001, dst)
CREATE SEQUENCE IF NOT EXISTS public.registration_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('public.registration_number_seq');
    RETURN 'DH-2027-' || LPAD(seq_val::TEXT, 4, '0');
END; $$;

-- 7. CHECK ROLE HELPER
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 8. TRIGGER AUTO-CREATE PROFILE & CANDIDATE ON REGISTRATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    reg_num TEXT;
    user_name TEXT;
    user_phone TEXT;
BEGIN
    reg_num := public.generate_registration_number();
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

    INSERT INTO public.profiles (user_id, full_name, email, phone, role, is_active)
    VALUES (NEW.id, user_name, NEW.email, user_phone, 'PESERTA'::user_role, true)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.candidates (user_id, registration_number, full_name, guardian_phone, status)
    VALUES (NEW.id, reg_num, user_name, user_phone, 'DRAFT'::candidate_status)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff view all profiles" ON public.profiles FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));
CREATE POLICY "Users insert own profile as PESERTA" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'PESERTA'::user_role);
CREATE POLICY "Users update own profile no role change" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL USING (public.get_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Peserta view own candidate" ON public.candidates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff view candidates" ON public.candidates FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));
CREATE POLICY "Peserta update candidate in draft" ON public.candidates FOR UPDATE USING (auth.uid() = user_id AND status IN ('DRAFT', 'PERLU_PERBAIKAN')) WITH CHECK (auth.uid() = user_id AND status IN ('DRAFT', 'TERDAFTAR', 'PERLU_PERBAIKAN') AND registration_number = (SELECT registration_number FROM public.candidates WHERE user_id = auth.uid()));
CREATE POLICY "Staff update candidates" ON public.candidates FOR UPDATE USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admin manage settings" ON public.system_settings FOR ALL USING (public.get_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Staff view audit logs" ON public.audit_logs FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));
CREATE POLICY "Users insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);`;

  const docSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 002: Document Types, Candidate Documents & Storage RLS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE document_verification_status AS ENUM (
        'BELUM_UPLOAD', 'MENUNGGU_VERIFIKASI', 'DITERIMA', 'DITOLAK'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_file_size_mb INTEGER NOT NULL DEFAULT 5,
    allowed_mime_types TEXT[] NOT NULL DEFAULT ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.document_types (code, name, description, is_required, is_active, max_file_size_mb, allowed_mime_types, sort_order)
VALUES
    ('KK', 'Kartu Keluarga (KK)', 'Scan atau foto berwarna KK asli/legalisir.', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 1),
    ('AKTA_KELAHIRAN', 'Akta Kelahiran', 'Scan atau foto akta kelahiran resmi calon santri.', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 2),
    ('KTP_ORANG_TUA', 'KTP Orang Tua', 'Scan atau foto e-KTP Ayah dan Ibu kandung (bisa multi-file).', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 3),
    ('KTP_WALI', 'KTP Wali', 'Scan atau foto e-KTP Wali resmi (jika diasuh wali).', false, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 4),
    ('DOKUMEN_SEKOLAH', 'Berkas Pendukung Sekolah', 'Scan rapor SD/MI kelas 6, SKL, atau kartu NISN.', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 5),
    ('PAS_FOTO', 'Pas Foto Santri', 'Pasfoto resmi 3x4 berwarna calon santri.', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp'], 6),
    ('BUKTI_PEMBAYARAN', 'Bukti Pembayaran Biaya Pendaftaran', 'Scan atau foto bukti transfer biaya infaq pendaftaran PSB.', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 7),
    ('BUKTI_DAFTAR_ULANG', 'Bukti Pembayaran Daftar Ulang (Khusus Santri Lulus)', 'Scan atau foto bukti transfer daftar ulang bagi calon santri yang dinyatakan LULUS.', false, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 8),
    ('DOKUMEN_PENDUKUNG', 'Berkas Pendukung Lainnya', 'Piagam tahfidz, sertifikat prestasi, atau berkas pendukung lainnya.', false, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 9)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.candidate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    status document_verification_status NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    rejection_reason TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active document types" ON public.document_types FOR SELECT USING (is_active = true);
CREATE POLICY "Staff view all document types" ON public.document_types FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));
CREATE POLICY "Super Admins manage document types" ON public.document_types FOR ALL USING (public.get_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Peserta view own documents" ON public.candidate_documents FOR SELECT
USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_documents.candidate_id AND candidates.user_id = auth.uid()));

CREATE POLICY "Staff view all candidate documents" ON public.candidate_documents FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Peserta upload own documents" ON public.candidate_documents FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_documents.candidate_id AND candidates.user_id = auth.uid() AND candidates.status IN ('DRAFT', 'TERDAFTAR', 'PERLU_PERBAIKAN'))
    AND status = 'MENUNGGU_VERIFIKASI'::document_verification_status
);

CREATE POLICY "Peserta update own unaccepted documents" ON public.candidate_documents FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_documents.candidate_id AND candidates.user_id = auth.uid()) AND status != 'DITERIMA'::document_verification_status)
WITH CHECK (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_documents.candidate_id AND candidates.user_id = auth.uid()) AND status = 'MENUNGGU_VERIFIKASI'::document_verification_status);

CREATE POLICY "Peserta delete own unaccepted documents" ON public.candidate_documents FOR DELETE
USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_documents.candidate_id AND candidates.user_id = auth.uid()) AND status != 'DITERIMA'::document_verification_status);

CREATE POLICY "Staff verify candidate documents" ON public.candidate_documents FOR UPDATE
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));`;

  const scheduleSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 003: Selection Schedules, Participant Assignment & Exam Cards
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.test_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.test_types (code, name, description, is_active, sort_order)
VALUES
    ('AKADEMIK', 'Tes Potensi Akademik', 'Ujian tertulis materi Matematika Dasar, IPA Terpadu, Bahasa Indonesia, dan PAI.', true, 1),
    ('QURAN', 'Tes Al-Qur''an (Tahfidz & Tajwid)', 'Uji kelancaran membaca Al-Qur''an, makharijul huruf, tajwid, dan setoran hafalan juz 30.', true, 2),
    ('PSIKOTES', 'Psikotes & Wawancara Santri/Wali', 'Asesmen kemandirian santri, minat bakat, wawancara kesiapan santri dan wali.', true, 3)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS public.test_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_type_id UUID NOT NULL REFERENCES public.test_types(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    test_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT NOT NULL,
    room TEXT NOT NULL,
    online_url TEXT,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.test_schedule_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.test_schedules(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    seat_number VARCHAR(20) NOT NULL,
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'BELUM_HADIR' CHECK (attendance_status IN ('BELUM_HADIR', 'HADIR', 'TERLAMBAT', 'TIDAK_HADIR')),
    attendance_note TEXT,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_test_schedule_candidate UNIQUE (schedule_id, candidate_id),
    CONSTRAINT uq_test_schedule_seat UNIQUE (schedule_id, seat_number)
);

CREATE TABLE IF NOT EXISTS public.candidate_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

ALTER TABLE public.test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedule_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active test types" ON public.test_types FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage test types" ON public.test_types FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Authenticated read active schedules" ON public.test_schedules FOR SELECT TO authenticated
USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));
CREATE POLICY "Staff manage schedules" ON public.test_schedules FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Peserta view own scheduled sessions" ON public.test_schedule_participants FOR SELECT
USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = test_schedule_participants.candidate_id AND candidates.user_id = auth.uid()));

CREATE POLICY "Staff view all schedule participants" ON public.test_schedule_participants FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Staff manage schedule participants" ON public.test_schedule_participants FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Peserta view own verification token" ON public.candidate_verification_tokens FOR SELECT
USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = candidate_verification_tokens.candidate_id AND candidates.user_id = auth.uid()));

CREATE POLICY "Staff manage verification tokens" ON public.candidate_verification_tokens FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));`;

  const cbtSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 004: Academic Computer Based Test (CBT) Module
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.subjects (code, name, description, is_active, sort_order)
VALUES
    ('MATEMATIKA', 'Matematika', 'Operasi hitung pecahan, FPB/KPK, bangun ruang, aljabar, dan perbandingan.', true, 1),
    ('BAHASA_INDONESIA', 'Bahasa Indonesia', 'Ide pokok paragraf, pemahaman teks, EYD, sinonim/antonim, dan tata bahasa.', true, 2),
    ('IPA', 'Ilmu Pengetahuan Alam (IPA)', 'Sistem organ tubuh, ekosistem makhluk hidup, energi dan kelistrikan, tata surya.', true, 3),
    ('PAI', 'Pendidikan Agama Islam (PAI)', 'Aqidah akhlak, fiqih ibadah, sejarah kebudayaan Islam, dan dasar hadits.', true, 4),
    ('PENGETAHUAN_UMUM', 'Pengetahuan Umum & Keislaman', 'Wawasan kebangsaan, sejarah Islam nusantara, budaya pesantren, dan logika.', true, 5)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.question_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES public.question_categories(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    explanation TEXT,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'SEDANG',
    points NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_key VARCHAR(10) NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_schedule_id UUID NOT NULL REFERENCES public.test_schedules(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    total_questions INTEGER NOT NULL DEFAULT 50,
    randomize_questions BOOLEAN NOT NULL DEFAULT true,
    randomize_options BOOLEAN NOT NULL DEFAULT true,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    passing_score NUMERIC(5, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    show_score_to_candidate BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.exam_question_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    question_count INTEGER NOT NULL DEFAULT 10,
    points_per_question NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    total_questions INTEGER NOT NULL DEFAULT 0,
    answered_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    raw_score NUMERIC(7, 2) NOT NULL DEFAULT 0.00,
    max_score NUMERIC(7, 2) NOT NULL DEFAULT 100.00,
    normalized_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exam_candidate_attempt UNIQUE (exam_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.exam_attempt_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    question_order INTEGER NOT NULL,
    question_text_snapshot TEXT NOT NULL,
    options_snapshot JSONB NOT NULL,
    points_snapshot NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    attempt_question_id UUID NOT NULL REFERENCES public.exam_attempt_questions(id) ON DELETE CASCADE,
    selected_option_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_text TEXT,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_marked BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.exam_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage subjects" ON public.subjects FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff read questions" ON public.questions FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));
CREATE POLICY "Staff read options" ON public.question_options FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Public read active exams" ON public.exams FOR SELECT USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));
CREATE POLICY "Staff manage exams" ON public.exams FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Peserta view own attempt" ON public.exam_attempts FOR SELECT USING (EXISTS (SELECT 1 FROM public.candidates WHERE candidates.id = exam_attempts.candidate_id AND candidates.user_id = auth.uid()));
CREATE POLICY "Staff view attempts" ON public.exam_attempts FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Peserta view snapshot questions" ON public.exam_attempt_questions FOR SELECT USING (EXISTS (SELECT 1 FROM public.exam_attempts JOIN public.candidates ON candidates.id = exam_attempts.candidate_id WHERE exam_attempts.id = exam_attempt_questions.attempt_id AND candidates.user_id = auth.uid()));
CREATE POLICY "Peserta manage own answers" ON public.exam_answers FOR ALL USING (EXISTS (SELECT 1 FROM public.exam_attempts JOIN public.candidates ON candidates.id = exam_attempts.candidate_id WHERE exam_attempts.id = exam_answers.attempt_id AND candidates.user_id = auth.uid()));`;

  const cmsSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 005: Landing Page CMS (Content Management System)
-- Versioning, Draft & Review Workflow, Public Schedule Integration & RLS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.landing_page_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL,
    site_short_name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    program_label TEXT NOT NULL,
    hero_badge TEXT NOT NULL,
    hero_title TEXT NOT NULL,
    hero_highlight TEXT NOT NULL,
    hero_description TEXT NOT NULL,
    hero_primary_button_text TEXT NOT NULL,
    hero_primary_button_link TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.landing_page_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(20) NOT NULL DEFAULT 'UMUM',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date_text TEXT NOT NULL,
    badge_color TEXT NOT NULL DEFAULT 'emerald',
    is_public BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_type VARCHAR(30) NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    link TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    button_text TEXT,
    button_link TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.landing_page_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INT NOT NULL,
    content_snapshot JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    notes TEXT
);

-- RLS: Public hanya membaca versi PUBLISHED
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published versions" ON public.landing_page_versions FOR SELECT USING (status = 'PUBLISHED');
CREATE POLICY "Staff read all versions" ON public.landing_page_versions FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));
CREATE POLICY "Staff manage draft versions" ON public.landing_page_versions FOR INSERT WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));
CREATE POLICY "Super admin publish versions" ON public.landing_page_versions FOR UPDATE USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PIMPINAN'));`;

  const qrScanSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 006: QR Camera Scan Logs & Attendance Tracking
-- ============================================================================

ALTER TABLE public.test_schedule_participants
ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scanned_by_name TEXT,
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scan_method VARCHAR(30) DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64);

CREATE TABLE IF NOT EXISTS public.candidate_qr_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    candidate_name TEXT,
    registration_number VARCHAR(30),
    token_id UUID REFERENCES public.candidate_verification_tokens(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE SET NULL,
    schedule_title TEXT,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    scanned_by_name TEXT,
    scan_method VARCHAR(30) NOT NULL CHECK (scan_method IN ('QR_CAMERA', 'MANUAL')),
    scan_result VARCHAR(40) NOT NULL CHECK (scan_result IN ('SUCCESS', 'SUCCESS_ALREADY_PRESENT', 'INVALID_TOKEN', 'NOT_FOUND', 'EXPIRED', 'NOT_ELIGIBLE', 'ERROR')),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_candidate ON public.candidate_qr_scan_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_schedule ON public.candidate_qr_scan_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_method ON public.candidate_qr_scan_logs(scan_method);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_result ON public.candidate_qr_scan_logs(scan_result);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_scanned_at ON public.candidate_qr_scan_logs(scanned_at DESC);

ALTER TABLE public.candidate_qr_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view qr scan logs"
    ON public.candidate_qr_scan_logs FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Staff insert qr scan logs"
    ON public.candidate_qr_scan_logs FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));`;

  const logoStorageSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 007: Landing Page Assets Storage & Logo Management
-- ============================================================================

-- 1. Pastikan kolom logo_path & favicon_path tersedia pada landing_page_settings
ALTER TABLE public.landing_page_settings
ADD COLUMN IF NOT EXISTS logo_path TEXT,
ADD COLUMN IF NOT EXISTS favicon_path TEXT;

-- 2. Buat Storage Bucket Publik untuk Aset CMS Landing Page (Logo & Banner Publik)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'landing-page-assets',
    'landing-page-assets',
    true, -- Bucket publik khusus untuk aset visual landing page
    2097152, -- Maksimal 2 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp'] -- PNG, JPG, WEBP (SVG ditolak demi keamanan)
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Storage RLS Policies untuk landing-page-assets
-- Catatan: Bucket candidate-documents tetap PRIVATE dan TIDAK diubah sama sekali.

-- Policy 1: Siapapun (Publik & Pengunjung Website) dapat membaca/menampilkan logo dari landing-page-assets
DROP POLICY IF EXISTS "Public read landing page assets" ON storage.objects;
CREATE POLICY "Public read landing page assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-page-assets');

-- Policy 2: Hanya SUPER_ADMIN dan PANITIA yang boleh mengunggah logo ke landing-page-assets
DROP POLICY IF EXISTS "Staff upload landing page assets" ON storage.objects;
CREATE POLICY "Staff upload landing page assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
);

-- Policy 3: Hanya SUPER_ADMIN dan PANITIA yang boleh memperbarui logo di landing-page-assets
DROP POLICY IF EXISTS "Staff update landing page assets" ON storage.objects;
CREATE POLICY "Staff update landing page assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
)
WITH CHECK (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
);

-- Policy 4: Hanya SUPER_ADMIN dan PANITIA yang boleh menghapus logo lama di landing-page-assets
DROP POLICY IF EXISTS "Staff delete landing page assets" ON storage.objects;
CREATE POLICY "Staff delete landing page assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
);`;

  const ctaSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 008: Bottom Call-To-Action (CTA) Settings
-- ============================================================================

ALTER TABLE public.landing_page_settings
ADD COLUMN IF NOT EXISTS cta_title TEXT,
ADD COLUMN IF NOT EXISTS cta_description TEXT,
ADD COLUMN IF NOT EXISTS cta_primary_button_text TEXT DEFAULT 'Daftar Sekarang',
ADD COLUMN IF NOT EXISTS cta_primary_button_link TEXT DEFAULT '/register',
ADD COLUMN IF NOT EXISTS cta_primary_button_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cta_secondary_button_text TEXT DEFAULT 'Hubungi Panitia',
ADD COLUMN IF NOT EXISTS cta_secondary_button_link TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS cta_secondary_button_active BOOLEAN DEFAULT true;`;

  const quranSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 009: Quran Assessment Module (Tahfidz, Tajwid & Makharij)
-- Offline Examiner Assessment, Rubrics, Scoring, Snapshots & Lock Workflow
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE quran_assignment_status AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE quran_assessment_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED', 'NEEDS_REVISION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.quran_rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    min_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (min_score >= 0),
    max_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (max_score > min_score),
    weight NUMERIC(5, 2) NOT NULL DEFAULT 35.00 CHECK (weight >= 0 AND weight <= 100),
    sort_order INTEGER NOT NULL DEFAULT 1,
    is_required BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quran_examiner_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.test_schedules(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    examiner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assignment_status quran_assignment_status NOT NULL DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_quran_assignment_schedule_candidate UNIQUE (schedule_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.quran_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.test_schedules(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    examiner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status quran_assessment_status NOT NULL DEFAULT 'NOT_STARTED',
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    raw_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    normalized_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    surah_name TEXT,
    ayat_range TEXT,
    juz_tested TEXT,
    reading_notes TEXT,
    notes TEXT,
    revision_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_quran_assessment_schedule_candidate UNIQUE (schedule_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.quran_assessment_rubric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.quran_assessments(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.quran_rubrics(id) ON DELETE RESTRICT,
    rubric_name_snapshot TEXT NOT NULL,
    description_snapshot TEXT NOT NULL,
    min_score_snapshot NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    max_score_snapshot NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    weight_snapshot NUMERIC(5, 2) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_assessment_rubric_snapshot UNIQUE (assessment_id, rubric_id)
);

CREATE TABLE IF NOT EXISTS public.quran_assessment_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.quran_assessments(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.quran_rubrics(id) ON DELETE RESTRICT,
    rubric_name_snapshot TEXT NOT NULL,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    weight NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    weighted_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    examiner_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_assessment_score_rubric UNIQUE (assessment_id, rubric_id)
);

ALTER TABLE public.quran_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_examiner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessment_rubric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessment_scores ENABLE ROW LEVEL SECURITY;`;

  const rbacHardeningSqlMigration = `-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 010: Hardened Role-Based Access Control (RBAC) & Row-Level Security (RLS)
-- PRINSIP: DEFAULT DENY (SUPER_ADMIN, PANITIA, PENGUJI_QURAN, PIMPINAN, PESERTA)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_profiles_select" ON public.profiles;
CREATE POLICY "rbac_profiles_select" ON public.profiles FOR SELECT TO authenticated
USING (
    auth.uid() = user_id
    OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
    OR (public.get_auth_role() = 'PENGUJI_QURAN' AND is_active = true)
);

DROP POLICY IF EXISTS "rbac_profiles_insert" ON public.profiles;
CREATE POLICY "rbac_profiles_insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
    (auth.uid() = user_id AND role = 'PESERTA'::user_role)
    OR public.get_auth_role() = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "rbac_profiles_update" ON public.profiles;
CREATE POLICY "rbac_profiles_update" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (
    (auth.uid() = user_id AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()))
    OR public.get_auth_role() = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "rbac_profiles_delete" ON public.profiles;
CREATE POLICY "rbac_profiles_delete" ON public.profiles FOR DELETE TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN');

-- 2. CANDIDATES RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_candidates_select" ON public.candidates;
CREATE POLICY "rbac_candidates_select" ON public.candidates FOR SELECT TO authenticated
USING (
    auth.uid() = user_id
    OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
    OR (
        public.get_auth_role() = 'PENGUJI_QURAN'
        AND EXISTS (
            SELECT 1 FROM public.quran_examiner_assignments qea
            WHERE qea.candidate_id = candidates.id AND qea.examiner_user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "rbac_candidates_insert" ON public.candidates;
CREATE POLICY "rbac_candidates_insert" ON public.candidates FOR INSERT TO authenticated
WITH CHECK (
    (auth.uid() = user_id AND status = 'DRAFT'::candidate_status)
    OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
);

DROP POLICY IF EXISTS "rbac_candidates_update" ON public.candidates;
CREATE POLICY "rbac_candidates_update" ON public.candidates FOR UPDATE TO authenticated
USING (
    (auth.uid() = user_id AND status IN ('DRAFT'::candidate_status, 'PERLU_PERBAIKAN'::candidate_status))
    OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
)
WITH CHECK (
    (
        auth.uid() = user_id
        AND status IN ('DRAFT'::candidate_status, 'TERDAFTAR'::candidate_status, 'PERLU_PERBAIKAN'::candidate_status)
        AND registration_number = (SELECT registration_number FROM public.candidates WHERE user_id = auth.uid())
    )
    OR (
        public.get_auth_role() = 'PANITIA'
        AND status NOT IN ('LULUS'::candidate_status, 'CADANGAN'::candidate_status, 'TIDAK_LULUS'::candidate_status)
    )
    OR public.get_auth_role() = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "rbac_candidates_delete" ON public.candidates;
CREATE POLICY "rbac_candidates_delete" ON public.candidates FOR DELETE TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN');

-- 3. CANDIDATE DOCUMENTS RLS
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_candidate_documents_select" ON public.candidate_documents;
CREATE POLICY "rbac_candidate_documents_select" ON public.candidate_documents FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_documents.candidate_id AND c.user_id = auth.uid())
    OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
);

DROP POLICY IF EXISTS "rbac_candidate_documents_update" ON public.candidate_documents;
CREATE POLICY "rbac_candidate_documents_update" ON public.candidate_documents FOR UPDATE TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'))
WITH CHECK (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 4. QURAN RUBRICS & ASSESSMENTS RLS
ALTER TABLE public.quran_rubrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_quran_rubrics_mutation" ON public.quran_rubrics;
CREATE POLICY "rbac_quran_rubrics_mutation" ON public.quran_rubrics FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

ALTER TABLE public.quran_examiner_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_quran_assignments_select" ON public.quran_examiner_assignments;
CREATE POLICY "rbac_quran_assignments_select" ON public.quran_examiner_assignments FOR SELECT TO authenticated
USING (
    public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
    OR (public.get_auth_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
);

ALTER TABLE public.quran_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_quran_assessments_select" ON public.quran_assessments;
CREATE POLICY "rbac_quran_assessments_select" ON public.quran_assessments FOR SELECT TO authenticated
USING (
    public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
    OR (public.get_auth_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
);

-- 5. CMS & AUDIT LOGS RLS
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_landing_versions_mutation" ON public.landing_page_versions;
CREATE POLICY "rbac_landing_versions_mutation" ON public.landing_page_versions FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_audit_logs_select" ON public.audit_logs;
CREATE POLICY "rbac_audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN');`;

  const storageSql = `-- Script Pembuatan Storage Bucket untuk Dokumen Santri (KK, Akta, Rapor, Foto)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'candidate-documents',
    'candidate-documents',
    false, -- Private bucket (dokumen privasi santri)
    5242880, -- Maksimal 5 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Peserta hanya dapat mengunggah ke folder berdasar user_id miliknya
CREATE POLICY "Peserta upload document to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'candidate-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Peserta hanya membaca dokumen miliknya, Panitia & Admin dapat membaca semua dokumen
CREATE POLICY "Peserta view own document, Panitia view all"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'candidate-documents' 
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN')
    )
);

-- RLS: Peserta dapat menghapus dokumen miliknya selama status masih DRAFT atau PERLU_PERBAIKAN
CREATE POLICY "Peserta delete own document in draft"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'candidate-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1 FROM public.candidates
        WHERE user_id = auth.uid() AND status IN ('DRAFT', 'PERLU_PERBAIKAN')
    )
);`;

  const adminCreationSql = `-- 1. Buat akun di Supabase Auth (Menu Authentication -> Users -> Add User)
-- Contoh email: admin@darulhikmah.sch.id
-- 2. Jalankan query berikut di SQL Editor Supabase untuk menetapkan Role SUPER_ADMIN:

UPDATE public.profiles
SET role = 'SUPER_ADMIN'::user_role
WHERE email = 'admin@darulhikmah.sch.id';

-- Atau untuk akun Panitia PSB:
UPDATE public.profiles
SET role = 'PANITIA'::user_role
WHERE email = 'panitia@darulhikmah.sch.id';`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {
      // fallback silent
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pusat Publish Gratis (Tanpa Billing/Debit) & Konfigurasi Database"
      subtitle="Arsitektur Zero-Billing Static SPA • Local Engine • Google Sheets Sync • Supabase Free Tier"
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {statusMessage && (
          <Alert
            type={statusMessage.type}
            message={statusMessage.text}
            onClose={() => setStatusMessage(null)}
          />
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('free_publish')}
            className={`pb-3 px-4 border-b-2 whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'free_publish'
                ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            0. Publish Gratis & Cloud Sync
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-3 px-4 border-b-2 whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'status'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            1. Status Proyek
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`pb-3 px-4 border-b-2 whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'editor'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            2. Buka SQL Editor
          </button>
          <button
            onClick={() => setActiveTab('migration')}
            className={`pb-3 px-4 border-b-2 whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'migration'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="w-4 h-4" />
            3. Jalankan Migration
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-3 px-4 border-b-2 whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'storage'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            4. Storage Bucket
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`pb-3 px-4 border-b-2 whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'admin'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            5. Akun Admin & Panitia
          </button>
        </div>

        {/* TAB 0: PUBLISH GRATIS TANPA BILLING & CLOUD SYNC */}
        {activeTab === 'free_publish' && (
          <div className="space-y-5 text-xs">
            {/* Diagnosis Banner */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-extrabold text-emerald-950 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Status Rebuild: 100% Bebas Tagihan / Tanpa Kartu Debit (Zero-Billing)</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider">
                  Siap Publish Gratis
                </span>
              </div>
              <p className="text-emerald-900 leading-relaxed">
                Aplikasi ini telah dibangun ulang dengan <strong>menghapus 3 pemicu tagihan (billing triggers)</strong> yang sebelumnya memaksa Anda memasukkan kartu debit/kredit saat publish di Firebase / AI Studio:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="font-bold text-slate-900">1. Firebase Data Connect Dihapus</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    File <code>firebase.json</code> &amp; <code>dataconnect/</code> yang memesan Cloud SQL PostgreSQL berbayar (Blaze Plan) telah dibersihkan.
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="font-bold text-slate-900">2. Flag Cloud Run Dihapus</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Kapabilitas <code>SERVER_SIDE_GEMINI_API</code> di <code>metadata.json</code> yang memicu Cloud Billing telah dinonaktifkan.
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="font-bold text-slate-900">3. Murni Static SPA ($0)</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Dependensi server <code>express</code> &amp; <code>@google/genai</code> dihapus sehingga bisa di-host 100% gratis di mana saja.
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Publik vs Mode Evaluasi Toggle & 1-Click All-in-One SQL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white border-2 border-emerald-600 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    Keamanan Publik (Tombol Uji Role)
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${publicDemoMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {publicDemoMode ? 'Mode Simulasi Rapat' : 'Mode Produksi Resmi'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Sebelum membagikan link ke wali santri, aktifkan <strong>Mode Produksi Resmi</strong> agar tombol <em>Uji Role</em> disembunyikan dari pengunjung umum.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTogglePublicDemoMode(false)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                      !publicDemoMode ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    🔒 Mode Produksi Resmi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePublicDemoMode(true)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                      publicDemoMode ? 'bg-amber-500 text-amber-950 border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    🧪 Mode Simulasi Rapat
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-400 text-xs flex items-center gap-1.5">
                      <Code className="w-4 h-4" />
                      Skrip Database All-in-One (Migrasi 001–016)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      1x Klik Setup
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Salin seluruh skema tabel (Pendaftar, Bukti Bayar, Jadwal, CBT, Psikotes, Qur'an, Seleksi Akhir &amp; RLS) hanya dengan 1 kali klik untuk ditempel di Supabase SQL Editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      [
                        fullSqlMigration,
                        docSqlMigration,
                        scheduleSqlMigration,
                        cbtSqlMigration,
                        cmsSqlMigration,
                        qrScanSqlMigration,
                        logoStorageSqlMigration,
                        ctaSqlMigration,
                        quranSqlMigration,
                        rbacHardeningSqlMigration,
                        storageSql
                      ].join('\n\n'),
                      setCopiedAllInOneSql
                    )
                  }
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copiedAllInOneSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedAllInOneSql ? 'Berhasil Disalin! Tempel di Supabase SQL Editor' : '⚡ Salin FULL SQL All-in-One (Lengkap)'}</span>
                </button>
              </div>
            </div>

            {/* Section A: Backup & Restore Database Lokal */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-700" />
                    Opsi 1: Mesin Database Mandiri + Backup/Restore JSON ($0 Tanpa Setup)
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Saat ini tersimpan <strong>{localStats.candidates.length} Calon Santri</strong>, <strong>{localStats.profiles.length} Akun Pengguna</strong>, <strong>{localStats.testSchedules.length} Jadwal Ujian</strong>, dan <strong>{localStats.questions.length} Bank Soal CBT/Psikotes</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Backup (.json)
                  </button>
                  <label className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-emerald-700" />
                    Impor Backup (.json)
                    <input type="file" accept=".json,application/json" onChange={handleImportJson} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={handleResetDefaultData}
                    className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset Seed
                  </button>
                </div>
              </div>
            </div>

            {/* Section B: Google Sheets Gratis via Apps Script */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-700" />
                    Opsi 2: Sinkronisasi ke Google Sheets Gratis (Tanpa Kartu Debit)
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Gunakan akun Google biasa (100% gratis) untuk mengirim seluruh rekap pendaftar langsung ke Google Spreadsheet panitia.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={copiedGasScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={() => copyToClipboard(gasAppsScriptCode, setCopiedGasScript)}
                >
                  {copiedGasScript ? 'Kode Apps Script Tersalin!' : 'Salin Kode Google Apps Script'}
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec (URL Web App Google Apps Script)"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleSyncToGoogleSheets}
                  disabled={isSyncingGas}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition shrink-0 cursor-pointer"
                >
                  {isSyncingGas ? 'Mengirim ke Sheets...' : 'Simpan & Sync ke Google Sheets'}
                </button>
              </div>
            </div>

            {/* Section C: Koneksi Instan Supabase Free Tier */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  Opsi 3: Hubungkan Supabase Free Tier Langsung dari Browser ($0 Selamanya)
                </h4>
                <p className="text-[11px] text-slate-600">
                  Supabase menyediakan database PostgreSQL + Auth + Storage gratis (500MB DB, 1GB Storage) <strong>tanpa perlu memasukkan kartu debit/kredit</strong>. Anda dapat memasukkan URL &amp; Anon Key di bawah ini kapan saja bahkan setelah web di-publish:
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Supabase Project URL</label>
                  <input
                    type="url"
                    value={runtimeUrl}
                    onChange={(e) => setRuntimeUrl(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Supabase Anon Public Key</label>
                  <input
                    type="text"
                    value={runtimeKey}
                    onChange={(e) => setRuntimeKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveRuntimeSupabase}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  Simpan Konfigurasi Supabase
                </button>
                <button
                  type="button"
                  onClick={handleClearRuntimeSupabase}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-xs transition cursor-pointer"
                >
                  Gunakan Mode Lokal Mandiri
                </button>
              </div>
            </div>

            {/* Section D: 4 Tempat Publish Gratis Tanpa Kartu Debit */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">
                4 Cara Publish Web App Ini Secara Gratis (100% Tanpa Kartu Debit / Tanpa Billing):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-extrabold text-emerald-800 text-xs">1. Vercel (Paket Hobby — $0 Selamanya)</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Daftar di <strong>vercel.com</strong> dengan akun GitHub (tanpa kartu debit). Import repositori proyek ini dan klik <strong>Deploy</strong>. File <code>vercel.json</code> sudah disiapkan otomatis.
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-extrabold text-emerald-800 text-xs">2. Netlify / Netlify Drop ($0 Tanpa Kartu)</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Daftar di <strong>netlify.com</strong> tanpa kartu kredit. Hubungkan ke GitHub atau jalankan <code>npm run build</code> lalu seret folder <code>dist</code> ke <strong>app.netlify.com/drop</strong>.
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-extrabold text-emerald-800 text-xs">3. Cloudflare Pages ($0 Unlimited Bandwidth)</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Buka <strong>pages.cloudflare.com</strong>, hubungkan GitHub, pilih preset <strong>Vite</strong> (Build: <code>npm run build</code>, Output: <code>dist</code>). Gratis tanpa perlu billing.
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="font-extrabold text-emerald-800 text-xs">4. GitHub Pages (Otomatis via Actions)</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    File <code>.github/workflows/deploy-github-pages.yml</code> sudah disertakan. Cukup push ke GitHub dan aktifkan menu <strong>Settings &rarr; Pages &rarr; GitHub Actions</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: STATUS KONEKSI & PRINSIP KEAMANAN */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-700" />
                Konfigurasi Environment Variable Saat Ini
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700">VITE_SUPABASE_URL:</span>
                  <span className="font-mono text-slate-900 truncate max-w-md">
                    {SUPABASE_URL || '<Belum dikonfigurasi di .env>'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700">VITE_SUPABASE_ANON_KEY:</span>
                  <span className="font-mono text-slate-900 truncate max-w-md">
                    {SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 16)}...` : '<Belum dikonfigurasi di .env>'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Status Koneksi:</span>
                  {isConnected ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Terhubung ke Supabase
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold">
                      Mode Fallback Aktif (Tambahkan kunci di .env untuk menghubungkan)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Critical Security Rules Card */}
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
                Prinsip Keamanan Client-Side (Zero Secret Exposure)
              </div>
              <ul className="list-disc list-inside space-y-1 text-emerald-950 text-xs">
                <li>
                  <strong>SERVICE_ROLE_KEY</strong> tidak pernah diminta, disimpan, atau diekspos di browser aplikasi.
                </li>
                <li>
                  Client hanya menggunakan <strong>URL</strong> dan <strong>Anon Public Key</strong>.
                </li>
                <li>
                  Semua otoritas keamanan diverifikasi langsung pada level database menggunakan <strong>Supabase Row Level Security (RLS)</strong>.
                </li>
                <li>
                  Pendaftar tidak dapat memalsukan nomor pendaftaran atau menaikkan hak akses menjadi Admin karena database trigger dan RLS menolaknya secara mutlak.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: CARA MEMBUKA SQL EDITOR */}
        {activeTab === 'editor' && (
          <div className="space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-sm">
              Langkah Membuka Supabase SQL Editor:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h5 className="font-bold text-slate-900">Buka Dashboard</h5>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Buka peramban ke{' '}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
                  >
                    supabase.com/dashboard <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  dan pilih proyek PSB PPTQM Darul Hikmah Anda.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h5 className="font-bold text-slate-900">Pilih Menu SQL Editor</h5>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Pada sidebar navigasi sebelah kiri, klik menu dengan ikon terminal/database <strong>SQL Editor</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h5 className="font-bold text-slate-900">Buat Query Baru</h5>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Klik tombol <strong>+ New query</strong>, tempelkan skrip migrasi dari tab berikutnya, lalu klik tombol <strong>Run</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CARA MENJALANKAN MIGRATION */}
        {activeTab === 'migration' && (
          <div className="space-y-3">
            {/* Sub-tabs for migrations */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setSelectedMigration('001')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '001'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 001: Skema Utama & Akun
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('002')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '002'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 002: Berkas & Dokumen Pendaftar
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('003')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '003'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 003: Jadwal Seleksi & Kartu Ujian
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('004')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '004'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 004: CBT Akademik & Bank Soal
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('005')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '005'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 005: CMS Landing Page
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('006')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '006'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 006: QR Camera Scan Logs
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('007')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '007'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 007: Storage Logo & Aset CMS
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('008')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '008'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 008: Pengaturan CTA Bawah
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('009')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '009'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 009: Tes Al-Qur'an (Tahfidz & Tajwid)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMigration('010')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedMigration === '010'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Migration 010: Hardened RBAC & RLS (Default Deny)
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  SQL Migration File:{' '}
                  <code className="text-emerald-800">
                    database/migrations/
                    {selectedMigration === '001'
                      ? '001_initial_schema.sql'
                      : selectedMigration === '002'
                      ? '002_candidate_documents.sql'
                      : selectedMigration === '003'
                      ? '003_schedules_and_cards.sql'
                      : selectedMigration === '004'
                      ? '004_academic_cbt.sql'
                      : selectedMigration === '005'
                      ? '005_landing_page_cms.sql'
                      : selectedMigration === '006'
                      ? '006_qr_camera_scan_logs.sql'
                      : selectedMigration === '007'
                      ? '007_landing_page_logo_storage.sql'
                      : selectedMigration === '008'
                      ? '008_bottom_cta_settings.sql'
                      : selectedMigration === '009'
                      ? '009_quran_assessment.sql'
                      : '010_rbac_and_rls_hardening.sql'}
                  </code>
                </h4>
                <p className="text-[11px] text-slate-500">
                  {selectedMigration === '001'
                    ? 'Mencakup tabel profiles, candidates, status_history, trigger registrasi otomatis, RLS policies, dan indeks.'
                    : selectedMigration === '002'
                    ? 'Mencakup tabel document_types, candidate_documents, initial seed KK/Akta/KTP, dan RLS verifikasi dokumen.'
                    : selectedMigration === '003'
                    ? 'Mencakup tabel test_types (Akademik, Quran, Psikotes), test_schedules, test_schedule_participants, token verifikasi QR, dan RLS seleksi.'
                    : selectedMigration === '004'
                    ? 'Mencakup tabel subjects, question_categories, questions, question_options, exams, exam_question_configs, exam_attempts, snapshot soal, autosave answers, dan scoring.'
                    : selectedMigration === '005'
                    ? 'Mencakup tabel landing_page_settings, stats, requirements, steps, public schedules, faqs, contacts, announcements, versions snapshot, dan RLS CMS.'
                    : selectedMigration === '006'
                    ? 'Mencakup tabel candidate_qr_scan_logs, kolom presensi QR kamera di test_schedule_participants, indeks performa, dan RLS pencatatan presensi.'
                    : selectedMigration === '007'
                    ? 'Mencakup bucket storage landing-page-assets (publik, maks 2MB, PNG/JPG/WEBP), kolom logo_path, dan RLS upload logo untuk Super Admin & Panitia.'
                    : selectedMigration === '008'
                    ? 'Mencakup kolom cta_title, cta_description, cta_primary_button_text, cta_primary_button_link, cta_secondary_button_text, dan status aktif pada landing_page_settings.'
                    : selectedMigration === '009'
                    ? 'Mencakup tabel quran_rubrics, quran_examiner_assignments, quran_assessments, rubric snapshots, score per rubric, trigger timestamp, dan RLS penguji Al-Qur\'an.'
                    : 'Mencakup hardening RLS policies lengkap untuk 5 role resmi (SUPER_ADMIN, PANITIA, PENGUJI_QURAN, PIMPINAN, PESERTA), pemisahan SELECT/INSERT/UPDATE/DELETE, isolasi penguji pada peserta tugasnya, dan default deny.'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                leftIcon={copiedMigration ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={() =>
                  copyToClipboard(
                    selectedMigration === '001'
                      ? fullSqlMigration
                      : selectedMigration === '002'
                      ? docSqlMigration
                      : selectedMigration === '003'
                      ? scheduleSqlMigration
                      : selectedMigration === '004'
                      ? cbtSqlMigration
                      : selectedMigration === '005'
                      ? cmsSqlMigration
                      : selectedMigration === '006'
                      ? qrScanSqlMigration
                      : selectedMigration === '007'
                      ? logoStorageSqlMigration
                      : selectedMigration === '008'
                      ? ctaSqlMigration
                      : selectedMigration === '009'
                      ? quranSqlMigration
                      : rbacHardeningSqlMigration,
                    setCopiedMigration
                  )
                }
              >
                {copiedMigration ? 'Tersalin ke Clipboard' : 'Salin SQL Migration Ini'}
              </Button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 leading-relaxed border border-slate-800 selection:bg-emerald-700">
              {selectedMigration === '001'
                ? fullSqlMigration
                : selectedMigration === '002'
                ? docSqlMigration
                : selectedMigration === '003'
                ? scheduleSqlMigration
                : selectedMigration === '004'
                ? cbtSqlMigration
                : selectedMigration === '005'
                ? cmsSqlMigration
                : selectedMigration === '006'
                ? qrScanSqlMigration
                : selectedMigration === '007'
                ? logoStorageSqlMigration
                : selectedMigration === '008'
                ? ctaSqlMigration
                : selectedMigration === '009'
                ? quranSqlMigration
                : rbacHardeningSqlMigration}
            </pre>
          </div>
        )}

        {/* TAB 4: CARA MEMBUAT STORAGE BUCKET */}
        {activeTab === 'storage' && (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                Persiapan Supabase Storage Bucket (candidate-documents)
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Bucket ini digunakan untuk menyimpan dokumen pendaftaran santri seperti Kartu Keluarga, Akta Kelahiran, Surat Keterangan Lulus, dan Pasfoto.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h5 className="font-bold text-slate-900">Langkah Pembuatan via Dashboard UI:</h5>
              <ol className="list-decimal list-inside space-y-1 text-slate-700">
                <li>Buka menu <strong>Storage</strong> di dashboard Supabase.</li>
                <li>Klik tombol <strong>New Bucket</strong>.</li>
                <li>Beri nama: <code className="bg-white px-1.5 py-0.5 rounded border font-mono">candidate-documents</code>.</li>
                <li>
                  Pastikan opsi <strong>Public Bucket dinonaktifkan (Private)</strong> agar dokumen santri terlindungi dan tidak bisa diakses publik tanpa izin.
                </li>
                <li>Atur file size limit: <strong>5 MB</strong>, allowed MIME: <code className="bg-white px-1.5 py-0.5 rounded border font-mono">image/*, application/pdf</code>.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Atau Buat Otomatis Menggunakan Script SQL RLS:</span>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={copiedStorageSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={() => copyToClipboard(storageSql, setCopiedStorageSql)}
                >
                  {copiedStorageSql ? 'Tersalin' : 'Salin SQL Storage'}
                </Button>
              </div>

              <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                {storageSql}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: CARA MEMBUAT USER ADMIN */}
        {activeTab === 'admin' && (
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                Cara Membuat Akun Super Admin & Panitia PSB
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Untuk alasan keamanan, pemberian role administrator tidak pernah dilakukan dari form publik registrasi di frontend, melainkan diverifikasi melalui database.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h5 className="font-bold text-slate-900">Prosedur Penetapan Akun Admin:</h5>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
                <li>
                  Daftarkan akun email melalui halaman <strong>Daftar Santri Baru</strong> atau langsung melalui menu <strong>Authentication &rarr; Users &rarr; Add User</strong> di Supabase.
                </li>
                <li>
                  Buka <strong>SQL Editor</strong> di Supabase, lalu jalankan query di bawah ini untuk meningkatkan role user menjadi <strong>SUPER_ADMIN</strong> atau <strong>PANITIA</strong>.
                </li>
              </ol>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Query SQL Penetapan Role:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={copiedAdminSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => copyToClipboard(adminCreationSql, setCopiedAdminSql)}
                  >
                    {copiedAdminSql ? 'Tersalin' : 'Salin SQL Role'}
                  </Button>
                </div>

                <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800">
                  {adminCreationSql}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
