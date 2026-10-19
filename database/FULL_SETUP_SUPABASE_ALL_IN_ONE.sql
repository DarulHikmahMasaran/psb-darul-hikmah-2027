-- ============================================================================
-- MASTER SQL SETUP ALL-IN-ONE (MIGRASI 001 S.D. 016 + BUCKET + PENGATURAN RESMI)
-- SISTEM PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Cara Pakai: Salin seluruh isi file ini -> Tempel di Supabase SQL Editor -> Klik RUN
-- ============================================================================


-- >>> BEGIN FILE: 001_initial_schema.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 001: Initial Schema, Security Hardening, RLS, & Storage
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS & DOMAINS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'SUPER_ADMIN',
        'PANITIA',
        'PENGUJI_QURAN',
        'PIMPINAN',
        'PESERTA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE candidate_status AS ENUM (
        'DRAFT',
        'TERDAFTAR',
        'PERLU_PERBAIKAN',
        'TERVERIFIKASI',
        'DIIZINKAN_MENGIKUTI_SELEKSI',
        'MENGIKUTI_SELEKSI',
        'SELESAI_SELEKSI',
        'LULUS',
        'CADANGAN',
        'TIDAK_LULUS',
        'DAFTAR_ULANG',
        'DITERIMA_FINAL',
        'BATAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

-- Table: profiles (Extends auth.users, stores roles & identities)
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

-- Table: candidates (Applicant data for SMP / Kelas 6 SD/MI)
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

-- Table: candidate_status_history (Audit trail for status mutations)
CREATE TABLE IF NOT EXISTS public.candidate_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    old_status candidate_status,
    new_status candidate_status NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: system_settings (System parameters & academic year config)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: audit_logs (System-wide action audit trail)
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

-- ----------------------------------------------------------------------------
-- 3. REGISTRATION NUMBER GENERATOR SEQUENCE (Server/DB Atomic Counter)
-- Format: DH-2027-0001, DH-2027-0002, etc. (Prevents race conditions)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.registration_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    seq_val BIGINT;
    reg_num TEXT;
BEGIN
    seq_val := nextval('public.registration_number_seq');
    reg_num := 'DH-2027-' || LPAD(seq_val::TEXT, 4, '0');
    RETURN reg_num;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. SECURITY DEFINER HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

-- Check user role helper (Security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- AUTOMATIC PROFILE & CANDIDATE CREATION TRIGGER ON AUTH.USERS INSERT
-- This ensures user role is ALWAYS 'PESERTA' upon registration and registration number
-- is generated on the server without needing Service Role Key on the client!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    reg_num TEXT;
    user_name TEXT;
    user_phone TEXT;
BEGIN
    reg_num := public.generate_registration_number();
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

    -- Insert profile with strictly forced PESERTA role
    INSERT INTO public.profiles (user_id, full_name, email, phone, role, is_active)
    VALUES (NEW.id, user_name, NEW.email, user_phone, 'PESERTA'::user_role, true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert initial candidate record
    INSERT INTO public.candidates (user_id, registration_number, full_name, guardian_phone, status)
    VALUES (NEW.id, reg_num, user_name, user_phone, 'DRAFT'::candidate_status)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Automatically record status history on candidate status update
CREATE OR REPLACE FUNCTION public.trg_candidate_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.candidate_status_history (
            candidate_id,
            old_status,
            new_status,
            changed_by,
            note
        ) VALUES (
            NEW.id,
            NULL,
            NEW.status,
            auth.uid(),
            'Pendaftaran santri baru dibuat'
        );
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.candidate_status_history (
            candidate_id,
            old_status,
            new_status,
            changed_by,
            note
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid(),
            'Perubahan status penerimaan santri'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_status_logger ON public.candidates;
CREATE TRIGGER trg_candidates_status_logger
AFTER INSERT OR UPDATE OF status ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.trg_candidate_status_history();

-- Updated_at touch function
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON public.candidates;
CREATE TRIGGER trg_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ----------------------------------------------------------------------------
-- 5. INDEXES FOR PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_candidates_reg_num ON public.candidates(registration_number);
CREATE INDEX IF NOT EXISTS idx_candidates_nik ON public.candidates(nik);
CREATE INDEX IF NOT EXISTS idx_candidates_nisn ON public.candidates(nisn);
CREATE INDEX IF NOT EXISTS idx_candidates_full_name ON public.candidates(full_name);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON public.candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_status_history_candidate_id ON public.candidate_status_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES - HARDENED
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Admins and Panitia can view all profiles
CREATE POLICY "Admins and Panitia can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Users can insert own profile, STRICTLY as PESERTA role (Anti-Privilege Escalation)
CREATE POLICY "Users can insert own profile as PESERTA"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id AND role = 'PESERTA'::user_role);

-- Users can update own profile, but CANNOT change role
CREATE POLICY "Users can update own profile without role change"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()));

-- Super Admins can manage all profiles
CREATE POLICY "Super Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.get_current_user_role() = 'SUPER_ADMIN');

-- CANDIDATES POLICIES
-- Peserta can view own candidate record
CREATE POLICY "Peserta can view own candidate data"
    ON public.candidates FOR SELECT
    USING (auth.uid() = user_id);

-- Admins and Panitia can view all candidates
CREATE POLICY "Admins and Panitia can view all candidates"
    ON public.candidates FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Peserta can update candidate record ONLY when status is DRAFT or PERLU_PERBAIKAN
-- Cannot change registration_number, and can only transition status to DRAFT or TERDAFTAR
CREATE POLICY "Peserta can update own candidate data in draft or perlu_perbaikan"
    ON public.candidates FOR UPDATE
    USING (
        auth.uid() = user_id AND status IN ('DRAFT', 'PERLU_PERBAIKAN')
    )
    WITH CHECK (
        auth.uid() = user_id 
        AND status IN ('DRAFT', 'TERDAFTAR', 'PERLU_PERBAIKAN')
        AND registration_number = (SELECT registration_number FROM public.candidates WHERE user_id = auth.uid())
    );

-- Admins and Panitia can update candidate records (verification, status changes)
CREATE POLICY "Admins and Panitia can update candidate data"
    ON public.candidates FOR UPDATE
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- Super Admins can do anything
CREATE POLICY "Super Admins full candidate control"
    ON public.candidates FOR ALL
    USING (public.get_current_user_role() = 'SUPER_ADMIN');

-- CANDIDATE STATUS HISTORY POLICIES
CREATE POLICY "Peserta can view own candidate status history"
    ON public.candidate_status_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_status_history.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and Panitia can view all status histories"
    ON public.candidate_status_history FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Admins and Panitia can insert status history"
    ON public.candidate_status_history FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- SYSTEM SETTINGS POLICIES
-- Everyone can read system settings
CREATE POLICY "Public read system settings"
    ON public.system_settings FOR SELECT
    USING (true);

-- Only Super Admin can modify system settings
CREATE POLICY "Super Admins manage system settings"
    ON public.system_settings FOR ALL
    USING (public.get_current_user_role() = 'SUPER_ADMIN');

-- AUDIT LOGS POLICIES
-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- Authenticated users can insert audit logs for actions they perform
CREATE POLICY "Users can create audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- ----------------------------------------------------------------------------
-- 7. SUPABASE STORAGE BUCKET & POLICIES (candidate-documents)
-- Disiapkan untuk modul upload dokumen santri (Kartu Keluarga, Akta, Rapor, Foto)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'candidate-documents',
    'candidate-documents',
    false,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Peserta hanya boleh upload ke folder dengan nama user_id miliknya
CREATE POLICY "Peserta upload document to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'candidate-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: Peserta hanya boleh membaca dokumen miliknya, Panitia/Admin boleh membaca semua
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

-- Storage RLS: Peserta boleh menghapus/mengganti dokumen miliknya sendiri jika status DRAFT/PERLU_PERBAIKAN
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
);


-- >>> BEGIN FILE: 002_candidate_documents.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 002: Document Types, Candidate Documents & Storage RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS FOR DOCUMENT VERIFICATION
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE document_verification_status AS ENUM (
        'BELUM_UPLOAD',
        'MENUNGGU_VERIFIKASI',
        'DITERIMA',
        'DITOLAK'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE: document_types (Configurable by Admin)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. SEED INITIAL DOCUMENT TYPES
-- ----------------------------------------------------------------------------
INSERT INTO public.document_types (code, name, description, is_required, is_active, max_file_size_mb, allowed_mime_types, sort_order)
VALUES
    (
        'KK',
        'Kartu Keluarga (KK)',
        'Scan atau foto berwarna Kartu Keluarga asli/legalisir yang mencantumkan nama calon santri (terlihat jelas NIK dan nomor KK).',
        true,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        1
    ),
    (
        'AKTA_KELAHIRAN',
        'Akta Kelahiran',
        'Scan atau foto akta kelahiran resmi calon santri dari Disdukcapil.',
        true,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        2
    ),
    (
        'KTP_ORANG_TUA',
        'KTP Orang Tua',
        'Scan atau foto e-KTP Ayah dan Ibu kandung. Anda dapat mengunggah lebih dari 1 file (KTP Ayah & KTP Ibu).',
        true,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        3
    ),
    (
        'KTP_WALI',
        'KTP Wali',
        'Scan atau foto e-KTP Wali resmi (hanya diperlukan apabila santri tidak tinggal bersama orang tua kandung).',
        false,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        4
    ),
    (
        'DOKUMEN_SEKOLAH',
        'Berkas Pendukung Sekolah',
        'Scan halaman biodata rapor SD/MI kelas 6 semester 1, Surat Keterangan Lulus/Aktif, atau kartu cetak NISN resmi.',
        true,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        5
    ),
    (
        'PAS_FOTO',
        'Pas Foto Santri',
        'Pasfoto resmi terbaru calon santri ukuran 3x4 berwarna (background merah/biru, berpakaian rapi/berpeci/berjilbab).',
        true,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp'],
        6
    ),
    (
        'DOKUMEN_PENDUKUNG',
        'Berkas Pendukung Lainnya',
        'Sertifikat kejuaraan tahfidz/akademik/prestasi, piagam penghargaan, atau surat keterangan lainnya (opsional).',
        false,
        true,
        5,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        7
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_required = EXCLUDED.is_required,
    is_active = EXCLUDED.is_active,
    max_file_size_mb = EXCLUDED.max_file_size_mb,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    sort_order = EXCLUDED.sort_order,
    updated_at = timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 4. TABLE: candidate_documents
-- ----------------------------------------------------------------------------
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate ON public.candidate_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_type ON public.candidate_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_status ON public.candidate_documents(status);

-- Updated_at triggers
DROP TRIGGER IF EXISTS trg_document_types_updated_at ON public.document_types;
CREATE TRIGGER trg_document_types_updated_at
BEFORE UPDATE ON public.document_types
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_candidate_documents_updated_at ON public.candidate_documents;
CREATE TRIGGER trg_candidate_documents_updated_at
BEFORE UPDATE ON public.candidate_documents
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) FOR DOCUMENT TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

-- DOCUMENT_TYPES POLICIES
-- Anyone authenticated or public can read active document types
CREATE POLICY "Public read active document types"
    ON public.document_types FOR SELECT
    USING (is_active = true);

-- Staff can view all document types
CREATE POLICY "Staff view all document types"
    ON public.document_types FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

-- Super Admin can manage document types
CREATE POLICY "Super Admins manage document types"
    ON public.document_types FOR ALL
    USING (public.get_current_user_role() = 'SUPER_ADMIN');

-- CANDIDATE_DOCUMENTS POLICIES
-- Peserta can view own documents
CREATE POLICY "Peserta can view own documents"
    ON public.candidate_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_documents.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

-- Panitia and Admins can view all candidate documents
CREATE POLICY "Staff can view all candidate documents"
    ON public.candidate_documents FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Peserta can upload (insert) documents for their own candidate record
-- Always forces status to MENUNGGU_VERIFIKASI
CREATE POLICY "Peserta can upload own documents"
    ON public.candidate_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_documents.candidate_id
              AND candidates.user_id = auth.uid()
              AND candidates.status IN ('DRAFT', 'TERDAFTAR', 'PERLU_PERBAIKAN')
        )
        AND status = 'MENUNGGU_VERIFIKASI'::document_verification_status
    );

-- Peserta can update own documents ONLY if not yet accepted (DITERIMA)
-- Peserta cannot change status, verified_by, verified_at, rejection_reason
CREATE POLICY "Peserta can update own unaccepted documents"
    ON public.candidate_documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_documents.candidate_id
              AND candidates.user_id = auth.uid()
        )
        AND status != 'DITERIMA'::document_verification_status
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_documents.candidate_id
              AND candidates.user_id = auth.uid()
        )
        AND status = 'MENUNGGU_VERIFIKASI'::document_verification_status
    );

-- Peserta can delete own documents ONLY if not yet accepted
CREATE POLICY "Peserta can delete own unaccepted documents"
    ON public.candidate_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_documents.candidate_id
              AND candidates.user_id = auth.uid()
        )
        AND status != 'DITERIMA'::document_verification_status
    );

-- Panitia & Super Admin can update candidate documents (verification acceptance/rejection)
CREATE POLICY "Staff can verify candidate documents"
    ON public.candidate_documents FOR UPDATE
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'))
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- ----------------------------------------------------------------------------
-- 6. STORAGE BUCKET & POLICIES (candidate-documents)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'candidate-documents',
    'candidate-documents',
    false, -- MUST BE PRIVATE (Signed URLs only)
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880;

-- Storage RLS: Peserta can upload into own folder (user_id)
DROP POLICY IF EXISTS "Peserta upload document to own folder" ON storage.objects;
CREATE POLICY "Peserta upload document to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'candidate-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: Peserta view own docs, staff view all docs
DROP POLICY IF EXISTS "Peserta view own document, Panitia view all" ON storage.objects;
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

-- Storage RLS: Peserta delete own docs (only if not verified)
DROP POLICY IF EXISTS "Peserta delete own document in draft" ON storage.objects;
CREATE POLICY "Peserta delete own document in draft"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'candidate-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);


-- >>> BEGIN FILE: 003_schedules_and_cards.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 003: Selection Schedules, Participant Assignment & Exam Cards
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: test_types (Jenis Seleksi: AKADEMIK, QURAN, PSIKOTES)
-- ----------------------------------------------------------------------------
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

-- Seed initial test types
INSERT INTO public.test_types (code, name, description, is_active, sort_order)
VALUES
    (
        'AKADEMIK',
        'Tes Potensi Akademik',
        'Ujian tertulis materi Matematika Dasar, IPA Terpadu, Bahasa Indonesia, dan Pendidikan Agama Islam.',
        true,
        1
    ),
    (
        'QURAN',
        'Tes Al-Qur''an (Tahfidz & Tajwid)',
        'Uji kelancaran membaca Al-Qur''an (fashahah & tartil), makharijul huruf, kaidah tajwid, dan setoran hafalan juz 30.',
        true,
        2
    ),
    (
        'PSIKOTES',
        'Psikotes & Wawancara Santri/Wali',
        'Asesmen kemandirian santri, psikotes minat bakat, wawancara kesiapan mondok santri dan komitmen orang tua/wali.',
        true,
        3
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 2. TABLE: test_schedules (Sesi Jadwal Seleksi)
-- ----------------------------------------------------------------------------
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

-- Indexes for schedule searches
CREATE INDEX IF NOT EXISTS idx_test_schedules_type ON public.test_schedules(test_type_id);
CREATE INDEX IF NOT EXISTS idx_test_schedules_date ON public.test_schedules(test_date);
CREATE INDEX IF NOT EXISTS idx_test_schedules_active ON public.test_schedules(is_active);

-- ----------------------------------------------------------------------------
-- 3. TABLE: test_schedule_participants (Penempatan Peserta pada Jadwal)
-- ----------------------------------------------------------------------------
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

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_schedule_participants_schedule ON public.test_schedule_participants(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_candidate ON public.test_schedule_participants(candidate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_attendance ON public.test_schedule_participants(attendance_status);

-- ----------------------------------------------------------------------------
-- 4. TABLE: candidate_verification_tokens (QR Code Verification Token)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tokens_candidate ON public.candidate_verification_tokens(candidate_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON public.candidate_verification_tokens(token_hash);

-- ----------------------------------------------------------------------------
-- 5. TABLE: candidate_notifications (Notifikasi Jadwal & Pengumuman)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SCHEDULE_UPDATE',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_candidate ON public.candidate_notifications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.candidate_notifications(candidate_id, is_read);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS: auto update timestamp
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_test_types_updated_at ON public.test_types;
CREATE TRIGGER trg_test_types_updated_at
BEFORE UPDATE ON public.test_types
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_test_schedules_updated_at ON public.test_schedules;
CREATE TRIGGER trg_test_schedules_updated_at
BEFORE UPDATE ON public.test_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_test_schedule_participants_updated_at ON public.test_schedule_participants;
CREATE TRIGGER trg_test_schedule_participants_updated_at
BEFORE UPDATE ON public.test_schedule_participants
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedule_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notifications ENABLE ROW LEVEL SECURITY;

-- 7.1 TEST_TYPES POLICIES
CREATE POLICY "Public read active test types"
    ON public.test_types FOR SELECT
    USING (is_active = true);

CREATE POLICY "Staff manage test types"
    ON public.test_types FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.2 TEST_SCHEDULES POLICIES
CREATE POLICY "Authenticated read active schedules"
    ON public.test_schedules FOR SELECT
    TO authenticated
    USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Staff manage schedules"
    ON public.test_schedules FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.3 TEST_SCHEDULE_PARTICIPANTS POLICIES
-- Peserta can ONLY view their own assigned sessions
CREATE POLICY "Peserta view own scheduled sessions"
    ON public.test_schedule_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = test_schedule_participants.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

-- Staff can view all participants across all sessions
CREATE POLICY "Staff view all schedule participants"
    ON public.test_schedule_participants FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Only Panitia and Super Admin can assign or remove participants
CREATE POLICY "Staff manage schedule participants"
    ON public.test_schedule_participants FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.4 CANDIDATE_VERIFICATION_TOKENS POLICIES
CREATE POLICY "Peserta view own verification token"
    ON public.candidate_verification_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_verification_tokens.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff view all verification tokens"
    ON public.candidate_verification_tokens FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Staff manage verification tokens"
    ON public.candidate_verification_tokens FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.5 CANDIDATE_NOTIFICATIONS POLICIES
CREATE POLICY "Peserta view own notifications"
    ON public.candidate_notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_notifications.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Peserta update read status own notifications"
    ON public.candidate_notifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_notifications.candidate_id
              AND candidates.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_notifications.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff insert notifications"
    ON public.candidate_notifications FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));


-- >>> BEGIN FILE: 004_academic_cbt.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 004: Academic Computer Based Test (CBT) Module
-- Question Bank, Exams, Immutable Question Snapshots, Attempts & Scoring
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: subjects (Mata Pelajaran Ujian Seleksi Akademik)
-- ----------------------------------------------------------------------------
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

-- Seed initial subjects
INSERT INTO public.subjects (code, name, description, is_active, sort_order)
VALUES
    ('MATEMATIKA', 'Matematika', 'Operasi hitung pecahan, FPB/KPK, bangun ruang & datar, aljabar dasar, dan perbandingan.', true, 1),
    ('BAHASA_INDONESIA', 'Bahasa Indonesia', 'Ide pokok paragraf, pemahaman teks, ejaan bahasa Indonesia, sinonim/antonim, dan tata bahasa.', true, 2),
    ('IPA', 'Ilmu Pengetahuan Alam (IPA)', 'Sistem organ tubuh, ekosistem makhluk hidup, energi dan kelistrikan dasar, tata surya.', true, 3),
    ('PAI', 'Pendidikan Agama Islam (PAI)', 'Aqidah akhlak, fiqih ibadah, sejarah kebudayaan Islam, dan dasar-dasar hadits.', true, 4),
    ('PENGETAHUAN_UMUM', 'Pengetahuan Umum & Keislaman', 'Wawasan kebangsaan, sejarah Islam nusantara, pengetahuan kepesantrenan, dan logika dasar.', true, 5)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 2. TABLE: question_categories (Kategori / Bab per Mata Pelajaran)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_categories_subject ON public.question_categories(subject_id);

-- ----------------------------------------------------------------------------
-- 3. TABLE: questions (Bank Soal)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE question_type_enum AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_SELECT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE question_difficulty_enum AS ENUM ('MUDAH', 'SEDANG', 'SULIT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES public.question_categories(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    question_type question_type_enum NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    explanation TEXT,
    difficulty question_difficulty_enum NOT NULL DEFAULT 'SEDANG',
    points NUMERIC(6, 2) NOT NULL DEFAULT 2.00 CHECK (points > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active ON public.questions(is_active);

-- ----------------------------------------------------------------------------
-- 4. TABLE: question_options (Pilihan Jawaban Soal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_key VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D', 'E' atau 'BENAR', 'SALAH'
    is_correct BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_options_question ON public.question_options(question_id);

-- ----------------------------------------------------------------------------
-- 5. TABLE: exams (Paket Ujian CBT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_schedule_id UUID NOT NULL REFERENCES public.test_schedules(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
    total_questions INTEGER NOT NULL DEFAULT 50 CHECK (total_questions > 0),
    randomize_questions BOOLEAN NOT NULL DEFAULT true,
    randomize_options BOOLEAN NOT NULL DEFAULT true,
    max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts = 1),
    passing_score NUMERIC(5, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    show_score_to_candidate BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_exams_schedule ON public.exams(test_schedule_id);
CREATE INDEX IF NOT EXISTS idx_exams_active ON public.exams(is_active);

-- ----------------------------------------------------------------------------
-- 6. TABLE: exam_question_configs (Komposisi Soal per Mapel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_question_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    question_count INTEGER NOT NULL CHECK (question_count >= 0),
    points_per_question NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_configs_exam ON public.exam_question_configs(exam_id);

-- ----------------------------------------------------------------------------
-- 7. TABLE: exam_attempts (Sesi Pengerjaan Ujian Peserta)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE exam_attempt_status_enum AS ENUM (
        'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'ABANDONED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    status exam_attempt_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
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

CREATE INDEX IF NOT EXISTS idx_attempts_candidate ON public.exam_attempts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.exam_attempts(status);

-- ----------------------------------------------------------------------------
-- 8. TABLE: exam_attempt_questions (Snapshot Soal Per Attempt - Imutable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_attempt_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    question_order INTEGER NOT NULL,
    question_text_snapshot TEXT NOT NULL,
    options_snapshot JSONB NOT NULL, -- Array of { id, option_key, option_text, sort_order } WITHOUT is_correct
    points_snapshot NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_attempt_question_order UNIQUE (attempt_id, question_order),
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt ON public.exam_attempt_questions(attempt_id);

-- ----------------------------------------------------------------------------
-- 9. TABLE: exam_answers (Autosave Jawaban Peserta)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    attempt_question_id UUID NOT NULL REFERENCES public.exam_attempt_questions(id) ON DELETE CASCADE,
    selected_option_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_text TEXT,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_marked BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_attempt_answer UNIQUE (attempt_id, attempt_question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_attempt ON public.exam_answers(attempt_id);

-- ----------------------------------------------------------------------------
-- 10. TABLE: exam_events (Audit Log Aktivitas CBT & Anti-Cheating)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_events_attempt ON public.exam_events(attempt_id);

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_events ENABLE ROW LEVEL SECURITY;

-- 11.1 SUBJECTS & CATEGORIES: Staff manage, all authenticated read active
CREATE POLICY "Public read active subjects" ON public.subjects FOR SELECT
USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Staff manage subjects" ON public.subjects FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Authenticated read categories" ON public.question_categories FOR SELECT
USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Staff manage categories" ON public.question_categories FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 11.2 QUESTIONS & OPTIONS: ONLY Staff can access question bank & options (Peserta NEVER reads questions table directly)
CREATE POLICY "Staff read questions" ON public.questions FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Staff manage questions" ON public.questions FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff read question options" ON public.question_options FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Staff manage question options" ON public.question_options FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 11.3 EXAMS & CONFIGS: Staff manage, Candidates read active exam for their schedule
CREATE POLICY "Authenticated read active exams" ON public.exams FOR SELECT
USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Staff manage exams" ON public.exams FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage exam configs" ON public.exam_question_configs FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff read exam configs" ON public.exam_question_configs FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

-- 11.4 EXAM ATTEMPTS: Peserta only sees their own attempt, cannot mutate scores
CREATE POLICY "Peserta view own attempt" ON public.exam_attempts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.candidates
        WHERE candidates.id = exam_attempts.candidate_id
          AND candidates.user_id = auth.uid()
    )
);

CREATE POLICY "Staff view all attempts" ON public.exam_attempts FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Peserta start own attempt" ON public.exam_attempts FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.candidates
        WHERE candidates.id = exam_attempts.candidate_id
          AND candidates.user_id = auth.uid()
          AND candidates.status IN ('TERVERIFIKASI', 'DIIZINKAN_MENGIKUTI_SELEKSI', 'MENGIKUTI_SELEKSI')
    )
    AND status = 'IN_PROGRESS'::exam_attempt_status_enum
);

CREATE POLICY "Peserta submit own attempt" ON public.exam_attempts FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.candidates
        WHERE candidates.id = exam_attempts.candidate_id
          AND candidates.user_id = auth.uid()
    )
    AND status = 'IN_PROGRESS'::exam_attempt_status_enum
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.candidates
        WHERE candidates.id = exam_attempts.candidate_id
          AND candidates.user_id = auth.uid()
    )
    AND status IN ('SUBMITTED', 'AUTO_SUBMITTED')
);

CREATE POLICY "Staff manage attempts" ON public.exam_attempts FOR ALL
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 11.5 EXAM ATTEMPT QUESTIONS: Peserta only sees questions for their own attempt
CREATE POLICY "Peserta view own snapshot questions" ON public.exam_attempt_questions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_attempt_questions.attempt_id
          AND candidates.user_id = auth.uid()
    )
);

CREATE POLICY "Staff view snapshot questions" ON public.exam_attempt_questions FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "System insert snapshot questions" ON public.exam_attempt_questions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_attempt_questions.attempt_id
          AND (candidates.user_id = auth.uid() OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'))
    )
);

-- 11.6 EXAM ANSWERS: Peserta can view and save their own answers while exam in progress
CREATE POLICY "Peserta view own answers" ON public.exam_answers FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_answers.attempt_id
          AND candidates.user_id = auth.uid()
    )
);

CREATE POLICY "Peserta insert own answer" ON public.exam_answers FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_answers.attempt_id
          AND candidates.user_id = auth.uid()
          AND exam_attempts.status = 'IN_PROGRESS'::exam_attempt_status_enum
          AND now() <= exam_attempts.expires_at
    )
);

CREATE POLICY "Peserta update own answer" ON public.exam_answers FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_answers.attempt_id
          AND candidates.user_id = auth.uid()
          AND exam_attempts.status = 'IN_PROGRESS'::exam_attempt_status_enum
          AND now() <= exam_attempts.expires_at
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_answers.attempt_id
          AND candidates.user_id = auth.uid()
          AND exam_attempts.status = 'IN_PROGRESS'::exam_attempt_status_enum
          AND now() <= exam_attempts.expires_at
    )
);

CREATE POLICY "Staff view all answers" ON public.exam_answers FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

-- 11.7 EXAM EVENTS: Audit log
CREATE POLICY "Peserta insert exam events" ON public.exam_events FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.exam_attempts
        JOIN public.candidates ON candidates.id = exam_attempts.candidate_id
        WHERE exam_attempts.id = exam_events.attempt_id
          AND candidates.user_id = auth.uid()
    )
);

CREATE POLICY "Staff view exam events" ON public.exam_events FOR SELECT
USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));


-- >>> BEGIN FILE: 005_landing_page_cms.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 005: Landing Page CMS (Content Management System)
-- Versioning, Draft & Review Workflow, Public Schedule Integration & RLS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE cms_version_status AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cms_contact_type AS ENUM ('WHATSAPP', 'INSTAGRAM', 'EMAIL', 'WEBSITE', 'ALAMAT', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cms_requirement_category AS ENUM ('UMUM', 'BERKAS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. LANDING PAGE SETTINGS (Singleton config)
CREATE TABLE IF NOT EXISTS public.landing_page_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL,
    site_short_name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    program_label TEXT NOT NULL,
    logo_path TEXT,
    favicon_path TEXT,
    hero_badge TEXT NOT NULL,
    hero_title TEXT NOT NULL,
    hero_highlight TEXT NOT NULL,
    hero_subtitle TEXT,
    hero_description TEXT NOT NULL,
    hero_primary_button_text TEXT NOT NULL,
    hero_primary_button_link TEXT NOT NULL,
    hero_secondary_button_text TEXT NOT NULL,
    hero_secondary_button_link TEXT NOT NULL,
    meta_title TEXT,
    meta_description TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LANDING PAGE STATS (Statistik Beranda)
CREATE TABLE IF NOT EXISTS public.landing_page_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. LANDING PAGE REQUIREMENTS (Persyaratan Pendaftaran)
CREATE TABLE IF NOT EXISTS public.landing_page_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category cms_requirement_category NOT NULL DEFAULT 'UMUM',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. LANDING PAGE STEPS (Alur Seleksi & Pendaftaran)
CREATE TABLE IF NOT EXISTS public.landing_page_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LANDING PAGE SCHEDULES (Agenda Kegiatan Publik)
CREATE TABLE IF NOT EXISTS public.landing_page_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date_text TEXT NOT NULL,
    badge_color TEXT NOT NULL DEFAULT 'emerald',
    test_schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. LANDING PAGE FAQS (Tanya Jawab / Accordion)
CREATE TABLE IF NOT EXISTS public.landing_page_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. LANDING PAGE CONTACTS & SOCIAL MEDIA
CREATE TABLE IF NOT EXISTS public.landing_page_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_type cms_contact_type NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    link TEXT,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LANDING PAGE ANNOUNCEMENTS (Banner Beranda dengan Rentang Waktu)
CREATE TABLE IF NOT EXISTS public.landing_page_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    button_text TEXT,
    button_link TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. LANDING PAGE VERSIONS (Audit Snapshot, Draft, Publish & Rollback)
CREATE TABLE IF NOT EXISTS public.landing_page_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INT NOT NULL,
    content_snapshot JSONB NOT NULL,
    status cms_version_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES auth.users(id),
    published_by_name TEXT,
    published_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cms_versions_status ON public.landing_page_versions(status);
CREATE INDEX IF NOT EXISTS idx_cms_versions_num ON public.landing_page_versions(version_number DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;

-- PUBLIC & PESERTA: Read-only access to published content
CREATE POLICY "Public read published versions" ON public.landing_page_versions
    FOR SELECT USING (status = 'PUBLISHED');

CREATE POLICY "Public read landing settings" ON public.landing_page_settings
    FOR SELECT USING (true);

CREATE POLICY "Public read active stats" ON public.landing_page_stats
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active requirements" ON public.landing_page_requirements
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active steps" ON public.landing_page_steps
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active public schedules" ON public.landing_page_schedules
    FOR SELECT USING (is_active = true AND is_public = true);

CREATE POLICY "Public read active faqs" ON public.landing_page_faqs
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active contacts" ON public.landing_page_contacts
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active announcements" ON public.landing_page_announcements
    FOR SELECT USING (
        is_active = true 
        AND (start_at IS NULL OR start_at <= NOW()) 
        AND (end_at IS NULL OR end_at >= NOW())
    );

-- STAFF (PANITIA, PIMPINAN, SUPER_ADMIN): Read all draft & active rows
CREATE POLICY "Staff read all cms versions" ON public.landing_page_versions
    FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Panitia create and edit draft versions" ON public.landing_page_versions
    FOR INSERT WITH CHECK (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        AND status IN ('DRAFT', 'REVIEW')
    );

CREATE POLICY "Panitia update draft versions" ON public.landing_page_versions
    FOR UPDATE USING (
        (public.get_current_user_role() = 'PANITIA' AND status IN ('DRAFT', 'REVIEW'))
        OR public.get_current_user_role() = 'SUPER_ADMIN'
        OR (public.get_current_user_role() = 'PIMPINAN' AND status = 'REVIEW')
    );

-- SUPER_ADMIN & PIMPINAN: Publish permissions
CREATE POLICY "Super admin and pimpinan publish versions" ON public.landing_page_versions
    FOR UPDATE USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PIMPINAN')
    );

-- Content tables write permissions (Staff manage drafts/content)
CREATE POLICY "Staff manage landing settings" ON public.landing_page_settings
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage stats" ON public.landing_page_stats
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage requirements" ON public.landing_page_requirements
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage steps" ON public.landing_page_steps
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage schedules" ON public.landing_page_schedules
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage faqs" ON public.landing_page_faqs
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage contacts" ON public.landing_page_contacts
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage announcements" ON public.landing_page_announcements
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));


-- >>> BEGIN FILE: 006_qr_camera_scan_logs.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 006: QR Camera Scan Logs & Attendance Tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD SCAN COLUMNS TO test_schedule_participants (if not exists)
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_schedule_participants
ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scanned_by_name TEXT,
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scan_method VARCHAR(30) DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64);

-- ----------------------------------------------------------------------------
-- 2. TABLE: candidate_qr_scan_logs
-- ----------------------------------------------------------------------------
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

-- Indexes for lightning fast lookups & audit logs
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_candidate ON public.candidate_qr_scan_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_schedule ON public.candidate_qr_scan_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_method ON public.candidate_qr_scan_logs(scan_method);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_result ON public.candidate_qr_scan_logs(scan_result);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_scanned_at ON public.candidate_qr_scan_logs(scanned_at DESC);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.candidate_qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- Staff & Panitia can read all scan logs
CREATE POLICY "Staff view qr scan logs"
    ON public.candidate_qr_scan_logs FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Staff & Panitia can insert scan logs
CREATE POLICY "Staff insert qr scan logs"
    ON public.candidate_qr_scan_logs FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));


-- >>> BEGIN FILE: 007_landing_page_logo_storage.sql <<<

-- ============================================================================
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
);


-- >>> BEGIN FILE: 008_bottom_cta_settings.sql <<<

-- ============================================================================
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
ADD COLUMN IF NOT EXISTS cta_secondary_button_active BOOLEAN DEFAULT true;


-- >>> BEGIN FILE: 009_quran_assessment.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 009: Quran Assessment Module (Tahfidz, Tajwid & Makharij)
-- Offline Examiner Assessment, Rubrics, Scoring, Snapshots & Lock Workflow
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS FOR QURAN ASSESSMENT & ASSIGNMENTS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE quran_assignment_status AS ENUM (
        'ASSIGNED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE quran_assessment_status AS ENUM (
        'NOT_STARTED',
        'IN_PROGRESS',
        'SUBMITTED',
        'LOCKED',
        'NEEDS_REVISION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE: quran_rubrics (Configurable Rubrics by Super Admin)
-- ----------------------------------------------------------------------------
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

-- Seed Default Rubrics (Tahfidz 35%, Tajwid 35%, Makharijul Huruf 30% = 100%)
INSERT INTO public.quran_rubrics (code, name, description, min_score, max_score, weight, sort_order, is_required, is_active)
VALUES
    (
        'TAHFIDZ',
        'Hafalan Al-Qur''an (Tahfidz)',
        'Kemampuan mengingat, menyambung, dan melafalkan ayat/surat yang diminta dari juz 30 atau hafalan tambahan santri sesuai ketentuan seleksi.',
        0.00,
        100.00,
        35.00,
        1,
        true,
        true
    ),
    (
        'TAJWID',
        'Kaidah Hukum Tajwid',
        'Ketepatan penerapan kaidah tajwid ketika membaca (ghunnah, mad thabi''i/far''i, hukum nun mati/tanwin, mim mati, idgham, ikhfa, dan qolqolah).',
        0.00,
        100.00,
        35.00,
        2,
        true,
        true
    ),
    (
        'MAKHARIJUL_HURUF',
        'Fashahah & Makharijul Huruf',
        'Ketepatan artikulasi dan tempat keluarnya makhraj huruf hijaiyah serta kesempurnaan sifat-sifat huruf (hams, jahr, isti''la, istifal).',
        0.00,
        100.00,
        30.00,
        3,
        true,
        true
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    min_score = EXCLUDED.min_score,
    max_score = EXCLUDED.max_score,
    weight = EXCLUDED.weight,
    sort_order = EXCLUDED.sort_order,
    is_required = EXCLUDED.is_required,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 3. TABLE: quran_examiner_assignments (Penugasan Penguji ke Peserta pada Jadwal)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_quran_assign_examiner ON public.quran_examiner_assignments(examiner_user_id);
CREATE INDEX IF NOT EXISTS idx_quran_assign_schedule ON public.quran_examiner_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_quran_assign_candidate ON public.quran_examiner_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_quran_assign_status ON public.quran_examiner_assignments(assignment_status);

-- ----------------------------------------------------------------------------
-- 4. TABLE: quran_assessments (Header Sesi Penilaian Al-Qur'an)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_quran_assess_candidate ON public.quran_assessments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_quran_assess_examiner ON public.quran_assessments(examiner_user_id);
CREATE INDEX IF NOT EXISTS idx_quran_assess_schedule ON public.quran_assessments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_quran_assess_status ON public.quran_assessments(status);

-- ----------------------------------------------------------------------------
-- 5. TABLE: quran_assessment_rubric_snapshots (Snapshot Rubrik saat Penilaian Dibuat)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_quran_snapshot_assessment ON public.quran_assessment_rubric_snapshots(assessment_id);

-- ----------------------------------------------------------------------------
-- 6. TABLE: quran_assessment_scores (Nilai Per Aspek Rubrik)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_quran_scores_assessment ON public.quran_assessment_scores(assessment_id);

-- ----------------------------------------------------------------------------
-- 7. TRIGGERS: auto update timestamp
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_quran_rubrics_updated_at ON public.quran_rubrics;
CREATE TRIGGER trg_quran_rubrics_updated_at
BEFORE UPDATE ON public.quran_rubrics
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_quran_examiner_assignments_updated_at ON public.quran_examiner_assignments;
CREATE TRIGGER trg_quran_examiner_assignments_updated_at
BEFORE UPDATE ON public.quran_examiner_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_quran_assessments_updated_at ON public.quran_assessments;
CREATE TRIGGER trg_quran_assessments_updated_at
BEFORE UPDATE ON public.quran_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_quran_assessment_scores_updated_at ON public.quran_assessment_scores;
CREATE TRIGGER trg_quran_assessment_scores_updated_at
BEFORE UPDATE ON public.quran_assessment_scores
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.quran_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_examiner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessment_rubric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessment_scores ENABLE ROW LEVEL SECURITY;

-- 8.1 QURAN_RUBRICS POLICIES
-- Semua staf dan penguji dapat melihat rubrik aktif
CREATE POLICY "Staff read active quran rubrics" ON public.quran_rubrics
    FOR SELECT USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Hanya SUPER_ADMIN yang boleh mengelola rubrik & bobot
CREATE POLICY "Super admin manage quran rubrics" ON public.quran_rubrics
    FOR ALL USING (public.get_current_user_role() = 'SUPER_ADMIN');

-- 8.2 QURAN_EXAMINER_ASSIGNMENTS POLICIES
-- Panitia, Super Admin, dan Pimpinan dapat melihat seluruh penugasan
-- Penguji hanya dapat melihat penugasan miliknya sendiri
CREATE POLICY "Staff view examiner assignments" ON public.quran_examiner_assignments
    FOR SELECT USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (public.get_current_user_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
    );

-- Panitia dan Super Admin dapat membuat/mengatur penugasan penguji
CREATE POLICY "Staff manage examiner assignments" ON public.quran_examiner_assignments
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 8.3 QURAN_ASSESSMENTS POLICIES
-- Staf dapat melihat semua assessment, penguji hanya dapat melihat miliknya
CREATE POLICY "Staff and examiner view quran assessments" ON public.quran_assessments
    FOR SELECT USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (public.get_current_user_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
    );

-- Penguji dapat membuat assessment baru hanya untuk peserta yang ditugaskan kepadanya
CREATE POLICY "Examiner insert assigned quran assessment" ON public.quran_assessments
    FOR INSERT WITH CHECK (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        OR (
            public.get_current_user_role() = 'PENGUJI_QURAN'
            AND examiner_user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.quran_examiner_assignments qea
                WHERE qea.schedule_id = quran_assessments.schedule_id
                  AND qea.candidate_id = quran_assessments.candidate_id
                  AND qea.examiner_user_id = auth.uid()
                  AND qea.assignment_status IN ('ASSIGNED', 'IN_PROGRESS')
            )
        )
    );

-- Penguji dapat mengupdate assessment miliknya HANYA jika status IN_PROGRESS atau NEEDS_REVISION
-- Dilarang update jika status sudah LOCKED
CREATE POLICY "Examiner update own unlocked quran assessment" ON public.quran_assessments
    FOR UPDATE USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        OR (
            public.get_current_user_role() = 'PENGUJI_QURAN'
            AND examiner_user_id = auth.uid()
            AND status IN ('NOT_STARTED', 'IN_PROGRESS', 'NEEDS_REVISION')
        )
    )
    WITH CHECK (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        OR (
            public.get_current_user_role() = 'PENGUJI_QURAN'
            AND examiner_user_id = auth.uid()
            AND status IN ('IN_PROGRESS', 'SUBMITTED', 'LOCKED')
        )
    );

-- 8.4 QURAN_ASSESSMENT_RUBRIC_SNAPSHOTS POLICIES
CREATE POLICY "Staff and examiner view rubric snapshots" ON public.quran_assessment_rubric_snapshots
    FOR SELECT USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR EXISTS (
            SELECT 1 FROM public.quran_assessments qa
            WHERE qa.id = quran_assessment_rubric_snapshots.assessment_id
              AND qa.examiner_user_id = auth.uid()
        )
    );

CREATE POLICY "Insert rubric snapshots on assessment creation" ON public.quran_assessment_rubric_snapshots
    FOR INSERT WITH CHECK (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        OR EXISTS (
            SELECT 1 FROM public.quran_assessments qa
            WHERE qa.id = quran_assessment_rubric_snapshots.assessment_id
              AND qa.examiner_user_id = auth.uid()
        )
    );

-- 8.5 QURAN_ASSESSMENT_SCORES POLICIES
CREATE POLICY "Staff and examiner view assessment scores" ON public.quran_assessment_scores
    FOR SELECT USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR EXISTS (
            SELECT 1 FROM public.quran_assessments qa
            WHERE qa.id = quran_assessment_scores.assessment_id
              AND qa.examiner_user_id = auth.uid()
        )
    );

CREATE POLICY "Examiner manage own unlocked assessment scores" ON public.quran_assessment_scores
    FOR ALL USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        OR EXISTS (
            SELECT 1 FROM public.quran_assessments qa
            WHERE qa.id = quran_assessment_scores.assessment_id
              AND qa.examiner_user_id = auth.uid()
              AND qa.status IN ('NOT_STARTED', 'IN_PROGRESS', 'NEEDS_REVISION')
        )
    );


-- >>> BEGIN FILE: 010_rbac_and_rls_hardening.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 010: Hardened Role-Based Access Control (RBAC) & Row-Level Security (RLS)
-- ============================================================================
-- 
-- PRINSIP KEAMANAN: DEFAULT DENY.
-- Memisahkan operasi SELECT, INSERT, UPDATE, dan DELETE secara eksplisit per Role:
-- 1. SUPER_ADMIN: Full access (READ, CREATE, UPDATE, DELETE).
-- 2. PANITIA: Hak operasional PSB (Pendaftar, Verifikasi Berkas, Jadwal, Presensi, Monitoring CBT).
--    TIDAK BOLEH: Ubah role, ubah passing grade, ubah rubrik, publish CMS, unlock nilai, delete audit log.
-- 3. PENGUJI_QURAN: Terbatas HANYA pada peserta yang ditugaskan (assigned candidates).
--    TIDAK BOLEH: Akses berkas KK/KTP santri, CBT, rubrik, status kelulusan, CMS, audit logs.
-- 4. PIMPINAN: EXECUTIVE READ-ONLY. Rekapitulasi & statistik agregat.
--    TIDAK BOLEH: Melakukan MUTASI apapun (NO INSERT, NO UPDATE, NO DELETE).
-- 5. PESERTA: Self-service pendaftar santri. Akses terisolasi pada data miliknya sendiri.
-- ============================================================================

-- Helper function to fetch caller role safely
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE RLS POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop prior loose policies if existing
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and Panitia can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile as PESERTA" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile without role change" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "rbac_profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "rbac_profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "rbac_profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "rbac_profiles_delete" ON public.profiles;

-- SELECT: Peserta view own; Staff (Super Admin, Panitia, Pimpinan, Penguji) can view necessary profiles
CREATE POLICY "rbac_profiles_select"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (public.get_auth_role() = 'PENGUJI_QURAN' AND is_active = true)
    );

-- INSERT: Self-registration strictly enforces PESERTA role; Only SUPER_ADMIN can create staff profiles
CREATE POLICY "rbac_profiles_insert"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.uid() = user_id AND role = 'PESERTA'::user_role)
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- UPDATE: Peserta can update own profile (CANNOT alter role); Super Admin can update any
CREATE POLICY "rbac_profiles_update"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.get_auth_role() = 'SUPER_ADMIN'
    )
    WITH CHECK (
        (
            auth.uid() = user_id 
            AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- DELETE: Strictly SUPER_ADMIN only
CREATE POLICY "rbac_profiles_delete"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 2. CANDIDATES TABLE RLS POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Peserta can view own candidate data" ON public.candidates;
DROP POLICY IF EXISTS "Admins and Panitia can view all candidates" ON public.candidates;
DROP POLICY IF EXISTS "Peserta can update own candidate data in draft or perlu_perbaikan" ON public.candidates;
DROP POLICY IF EXISTS "Admins and Panitia can update candidate data" ON public.candidates;
DROP POLICY IF EXISTS "Super Admins full candidate control" ON public.candidates;
DROP POLICY IF EXISTS "rbac_candidates_select" ON public.candidates;
DROP POLICY IF EXISTS "rbac_candidates_insert" ON public.candidates;
DROP POLICY IF EXISTS "rbac_candidates_update" ON public.candidates;
DROP POLICY IF EXISTS "rbac_candidates_delete" ON public.candidates;

-- SELECT:
-- Peserta: Only own record
-- Super Admin, Panitia, Pimpinan: Can view candidates
-- Penguji Quran: ONLY candidates assigned to them in quran_examiner_assignments
CREATE POLICY "rbac_candidates_select"
    ON public.candidates FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (
            public.get_auth_role() = 'PENGUJI_QURAN'
            AND EXISTS (
                SELECT 1 FROM public.quran_examiner_assignments qea
                WHERE qea.candidate_id = candidates.id
                  AND qea.examiner_user_id = auth.uid()
            )
        )
    );

-- INSERT:
-- Peserta creates initial candidate draft; Super Admin & Panitia can create if needed
CREATE POLICY "rbac_candidates_insert"
    ON public.candidates FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.uid() = user_id AND status = 'DRAFT'::candidate_status)
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    );

-- UPDATE:
-- Peserta: Only when status is DRAFT or PERLU_PERBAIKAN, cannot alter registration_number or final graduation status
-- Panitia: Operational status transitions (TERVERIFIKASI, PERLU_PERBAIKAN, DIIZINKAN_MENGIKUTI_SELEKSI). CANNOT set LULUS/CADANGAN/TIDAK_LULUS.
-- Super Admin: Full status management (including LULUS, CADANGAN, TIDAK_LULUS)
CREATE POLICY "rbac_candidates_update"
    ON public.candidates FOR UPDATE
    TO authenticated
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

-- DELETE: Strictly SUPER_ADMIN only
CREATE POLICY "rbac_candidates_delete"
    ON public.candidates FOR DELETE
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 3. CANDIDATE DOCUMENTS & VERIFICATION POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_candidate_documents_select" ON public.candidate_documents;
DROP POLICY IF EXISTS "rbac_candidate_documents_insert" ON public.candidate_documents;
DROP POLICY IF EXISTS "rbac_candidate_documents_update" ON public.candidate_documents;
DROP POLICY IF EXISTS "rbac_candidate_documents_delete" ON public.candidate_documents;

-- SELECT:
-- Peserta: Only documents for own candidate record
-- Panitia & Super Admin: Can view candidate documents for verification
-- Pimpinan & Penguji Quran: DENY (Pimpinan does not review individual family papers, Penguji does not access family docs)
CREATE POLICY "rbac_candidate_documents_select"
    ON public.candidate_documents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates c
            WHERE c.id = candidate_documents.candidate_id
              AND c.user_id = auth.uid()
        )
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    );

-- INSERT:
-- Peserta can upload documents for own candidate record; Super Admin & Panitia can assist
CREATE POLICY "rbac_candidate_documents_insert"
    ON public.candidate_documents FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.candidates c
            WHERE c.id = candidate_documents.candidate_id
              AND c.user_id = auth.uid()
              AND c.status IN ('DRAFT'::candidate_status, 'PERLU_PERBAIKAN'::candidate_status)
        )
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    );

-- UPDATE:
-- Panitia & Super Admin: Verify, accept, or reject with notes
CREATE POLICY "rbac_candidate_documents_update"
    ON public.candidate_documents FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'))
    WITH CHECK (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- DELETE:
-- Peserta can delete/re-upload document if status is DRAFT or PERLU_PERBAIKAN; Super Admin can delete
CREATE POLICY "rbac_candidate_documents_delete"
    ON public.candidate_documents FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates c
            WHERE c.id = candidate_documents.candidate_id
              AND c.user_id = auth.uid()
              AND c.status IN ('DRAFT'::candidate_status, 'PERLU_PERBAIKAN'::candidate_status)
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- ----------------------------------------------------------------------------
-- 4. QURAN RUBRICS & ASSESSMENTS HARDENED POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.quran_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_examiner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_assessment_items ENABLE ROW LEVEL SECURITY;

-- Rubrics:
-- All authenticated staff can SELECT rubrics to display grading criteria
DROP POLICY IF EXISTS "rbac_quran_rubrics_select" ON public.quran_rubrics;
CREATE POLICY "rbac_quran_rubrics_select"
    ON public.quran_rubrics FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Rubrics MUTATION (INSERT, UPDATE, DELETE): Strictly SUPER_ADMIN only
DROP POLICY IF EXISTS "rbac_quran_rubrics_mutation" ON public.quran_rubrics;
CREATE POLICY "rbac_quran_rubrics_mutation"
    ON public.quran_rubrics FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- Examiner Assignments:
-- Super Admin, Panitia, Pimpinan: SELECT all assignments
-- Penguji: SELECT only their assigned assignments
DROP POLICY IF EXISTS "rbac_quran_assignments_select" ON public.quran_examiner_assignments;
CREATE POLICY "rbac_quran_assignments_select"
    ON public.quran_examiner_assignments FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (public.get_auth_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
    );

-- Examiner Assignments Mutation: Super Admin & Panitia can assign examiners
DROP POLICY IF EXISTS "rbac_quran_assignments_mutation" ON public.quran_examiner_assignments;
CREATE POLICY "rbac_quran_assignments_mutation"
    ON public.quran_examiner_assignments FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'))
    WITH CHECK (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- Quran Assessments:
-- SELECT:
-- Super Admin, Panitia, Pimpinan: View all assessments
-- Penguji Quran: ONLY assessments where examiner_user_id = auth.uid()
-- Peserta: View locked assessment for own candidate record if authorized
DROP POLICY IF EXISTS "rbac_quran_assessments_select" ON public.quran_assessments;
CREATE POLICY "rbac_quran_assessments_select"
    ON public.quran_assessments FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (public.get_auth_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
        OR (
            public.get_auth_role() = 'PESERTA'
            AND status = 'LOCKED'
            AND EXISTS (
                SELECT 1 FROM public.candidates c
                WHERE c.id = quran_assessments.candidate_id
                  AND c.user_id = auth.uid()
            )
        )
    );

-- Assessments INSERT & UPDATE:
-- Penguji: Can start and submit assessments for their own assignment
-- Super Admin: Full control (including unlock)
-- Panitia: Can request revision (set NEEDS_REVISION), cannot unlock without permission
DROP POLICY IF EXISTS "rbac_quran_assessments_update" ON public.quran_assessments;
CREATE POLICY "rbac_quran_assessments_update"
    ON public.quran_assessments FOR UPDATE
    TO authenticated
    USING (
        (public.get_auth_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid() AND status != 'LOCKED')
        OR (public.get_auth_role() = 'PANITIA')
        OR public.get_auth_role() = 'SUPER_ADMIN'
    )
    WITH CHECK (
        (public.get_auth_role() = 'PENGUJI_QURAN' AND examiner_user_id = auth.uid())
        OR (public.get_auth_role() = 'PANITIA' AND status = 'NEEDS_REVISION')
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- ----------------------------------------------------------------------------
-- 5. CMS LANDING PAGE POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;

-- Versions SELECT: Authenticated staff can view draft & historical versions
DROP POLICY IF EXISTS "rbac_landing_versions_select" ON public.landing_page_versions;
CREATE POLICY "rbac_landing_versions_select"
    ON public.landing_page_versions FOR SELECT
    TO authenticated
    USING (
        status = 'PUBLISHED'
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    );

-- Versions INSERT & UPDATE:
-- Strictly SUPER_ADMIN only for PUBLISH and ROLLBACK
DROP POLICY IF EXISTS "rbac_landing_versions_mutation" ON public.landing_page_versions;
CREATE POLICY "rbac_landing_versions_mutation"
    ON public.landing_page_versions FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- Settings:
-- Public & all roles can read landing settings
DROP POLICY IF EXISTS "rbac_landing_settings_select" ON public.landing_page_settings;
CREATE POLICY "rbac_landing_settings_select"
    ON public.landing_page_settings FOR SELECT
    USING (true);

-- Settings update: Super Admin only
DROP POLICY IF EXISTS "rbac_landing_settings_update" ON public.landing_page_settings;
CREATE POLICY "rbac_landing_settings_update"
    ON public.landing_page_settings FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 6. SYSTEM SETTINGS & AUDIT LOGS POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- System Settings: Read-only for authenticated users; strictly SUPER_ADMIN to mutate
DROP POLICY IF EXISTS "rbac_system_settings_select" ON public.system_settings;
CREATE POLICY "rbac_system_settings_select"
    ON public.system_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "rbac_system_settings_mutation" ON public.system_settings;
CREATE POLICY "rbac_system_settings_mutation"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- Audit Logs:
-- SELECT: Strictly SUPER_ADMIN only
-- INSERT: Any authenticated session can record audit trail
-- UPDATE/DELETE: ABSOLUTELY NO ONE (Audit logs are immutable)
DROP POLICY IF EXISTS "rbac_audit_logs_select" ON public.audit_logs;
CREATE POLICY "rbac_audit_logs_select"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "rbac_audit_logs_insert" ON public.audit_logs;
CREATE POLICY "rbac_audit_logs_insert"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- ----------------------------------------------------------------------------
-- 7. STORAGE POLICIES HARDENING (candidate-documents)
-- ----------------------------------------------------------------------------
-- Peserta: Hanya dokumen di subfolder miliknya
-- Panitia & Super Admin: Verifikasi berkas
-- Penguji Quran & Pimpinan: TIDAK DIIZINKAN (DENY)
DROP POLICY IF EXISTS "Peserta view own document, Panitia view all" ON storage.objects;
DROP POLICY IF EXISTS "rbac_storage_documents_select" ON storage.objects;

CREATE POLICY "rbac_storage_documents_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'candidate-documents'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    )
);

-- Landing page assets: Public read, Super Admin write
DROP POLICY IF EXISTS "rbac_storage_landing_assets" ON storage.objects;
CREATE POLICY "rbac_storage_landing_assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'landing-page-assets'
    AND public.get_auth_role() = 'SUPER_ADMIN'
);


-- >>> BEGIN FILE: 011_psychotest.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 011: Psychotest CBT Module (Reuse Generic CBT Engine)
-- Question Bank, Visual Patterns, Configurable Scoring, Category Breakdown & RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALTER EXISTING CBT TABLES FOR PSYCHOTEST SUPPORT
-- ----------------------------------------------------------------------------

-- 1.1 Support exam type ('ACADEMIC' | 'PSYCHOTEST') in exams table
ALTER TABLE public.exams 
    ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20) NOT NULL DEFAULT 'ACADEMIC';

CREATE INDEX IF NOT EXISTS idx_exams_type ON public.exams(exam_type);

-- 1.2 Support visual question attachments & sub-categories in questions table
ALTER TABLE public.questions 
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100);

-- 1.3 Support configurable option-level score in question_options table
-- (e.g. A=1, B=0 or weighted options A=0, B=2, C=1, D=0)
ALTER TABLE public.question_options 
    ADD COLUMN IF NOT EXISTS score NUMERIC(6, 2) DEFAULT 0.00;

-- 1.4 Support category-level composition in exam_question_configs table
ALTER TABLE public.exam_question_configs 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.question_categories(id) ON DELETE CASCADE,
    ALTER COLUMN subject_id DROP NOT NULL;

-- 1.5 Support category & image snapshots in exam_attempt_questions table (Immutable snapshot)
ALTER TABLE public.exam_attempt_questions 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.question_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category_name_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS image_url_snapshot TEXT;

-- 1.6 Support category breakdown & scoring configuration snapshot in exam_attempts table
ALTER TABLE public.exam_attempts 
    ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS scoring_snapshot JSONB;

-- ----------------------------------------------------------------------------
-- 2. TABLE: psychotest_scoring_configs (Konfigurasi Bobot & Scoring Kategori)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE psychotest_scoring_model_enum AS ENUM ('BINARY', 'WEIGHTED_OPTION', 'SCALE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.psychotest_scoring_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.question_categories(id) ON DELETE CASCADE,
    scoring_model psychotest_scoring_model_enum NOT NULL DEFAULT 'BINARY',
    default_correct_score NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    default_wrong_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    normalization_base NUMERIC(6, 2) NOT NULL DEFAULT 100.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_psychotest_scoring_category UNIQUE (category_id)
);

CREATE INDEX IF NOT EXISTS idx_psychotest_scoring_category ON public.psychotest_scoring_configs(category_id);

-- ----------------------------------------------------------------------------
-- 3. SEED SUBJECT & DEFAULT CATEGORIES FOR PSIKOTES
-- ----------------------------------------------------------------------------
-- Insert Subject: PSIKOTES
INSERT INTO public.subjects (code, name, description, is_active, sort_order)
VALUES (
    'PSIKOTES', 
    'Psikotes & Penalaran Calon Santri', 
    'Asesmen potensi kognitif, kemampuan logika, penalaran, konsentrasi, ketelitian, dan daya tangkap santri.',
    true,
    6
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc'::text, now());

-- Insert Default Configurable 8 Categories for PSIKOTES
DO $$
DECLARE
    v_subject_id UUID;
BEGIN
    SELECT id INTO v_subject_id FROM public.subjects WHERE code = 'PSIKOTES' LIMIT 1;
    
    IF v_subject_id IS NOT NULL THEN
        -- 1. LOGIKA
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'LOGIKA', 'Kemampuan berpikir logis, silogisme, dan penarikan kesimpulan santri.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'LOGIKA');

        -- 2. PENALARAN
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'PENALARAN', 'Kemampuan analitis pemecahan masalah dan keteraturan berpikir.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'PENALARAN');

        -- 3. NUMERIK
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'NUMERIK', 'Pola deret angka, aritmatika verbal, dan penalaran kuantitatif dasar.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'NUMERIK');

        -- 4. VERBAL
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'VERBAL', 'Analogi kata, hubungan makna kata, dan pemahaman asosiasi kalimat.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'VERBAL');

        -- 5. VISUAL
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'VISUAL', 'Pola gambar matriks, urutan bentuk, dan kecocokan visual.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'VISUAL');

        -- 6. SPASIAL
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'SPASIAL', 'Rotasi bangun ruang 2D/3D, jaring-jaring bentuk, dan perspektif ruang.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'SPASIAL');

        -- 7. KETELITIAN
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'KETELITIAN', 'Akurasi perbandingan simbol/huruf/angka dan kecermatan membaca detail.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'KETELITIAN');

        -- 8. KONSENTRASI
        INSERT INTO public.question_categories (subject_id, name, description, is_active)
        SELECT v_subject_id, 'KONSENTRASI', 'Fokus stabilitas perhatian, konsistensi instruksi, dan daya tahan pengerjaan.', true
        WHERE NOT EXISTS (SELECT 1 FROM public.question_categories WHERE subject_id = v_subject_id AND name = 'KONSENTRASI');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FOR PSYCHOTEST SCORING CONFIGS
-- ----------------------------------------------------------------------------
ALTER TABLE public.psychotest_scoring_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_psychotest_scoring_select" ON public.psychotest_scoring_configs;
CREATE POLICY "rbac_psychotest_scoring_select"
    ON public.psychotest_scoring_configs FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
    );

DROP POLICY IF EXISTS "rbac_psychotest_scoring_mutation" ON public.psychotest_scoring_configs;
CREATE POLICY "rbac_psychotest_scoring_mutation"
    ON public.psychotest_scoring_configs FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- Note:
-- PENGUJI_QURAN: Denied (tidak memiliki hak akses ke psikotes)
-- PESERTA: Denied membaca scoring configuration & key langsung
-- PANITIA: Read only untuk operasional & monitoring
-- SUPER_ADMIN: Full CRUD


-- >>> BEGIN FILE: 012_cbt_psikotes_rls_hardening.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 012: CBT & Psikotes RLS Final Hardening
-- Enforces SUPER_ADMIN-only authorization for CBT_FORCE_SUBMIT and CBT_RESET
-- Denies PANITIA from modifying exam attempts, exams, questions, and scoring configs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDEN EXAM_ATTEMPTS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

-- Drop legacy permissive policies that allowed PANITIA full management
DROP POLICY IF EXISTS "Staff manage attempts" ON public.exam_attempts;
DROP POLICY IF EXISTS "rbac_exam_attempts_manage" ON public.exam_attempts;
DROP POLICY IF EXISTS "rbac_exam_attempts_select" ON public.exam_attempts;
DROP POLICY IF EXISTS "rbac_exam_attempts_mutation" ON public.exam_attempts;

-- 1.1 SELECT: Super Admin, Panitia (for operational monitoring), and Pimpinan (read-only executive review)
CREATE POLICY "rbac_exam_attempts_staff_select"
    ON public.exam_attempts FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
    );

-- 1.2 SELECT: Peserta can view ONLY their own attempts
CREATE POLICY "rbac_exam_attempts_peserta_select"
    ON public.exam_attempts FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'PESERTA'
        AND EXISTS (
            SELECT 1 FROM public.candidates c
            WHERE c.id = exam_attempts.candidate_id
              AND c.user_id = auth.uid()
        )
    );

-- 1.3 INSERT: Peserta starts their own attempt (if assigned & active), or Super Admin
CREATE POLICY "rbac_exam_attempts_insert"
    ON public.exam_attempts FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            public.get_auth_role() = 'PESERTA'
            AND EXISTS (
                SELECT 1 FROM public.candidates c
                WHERE c.id = exam_attempts.candidate_id
                  AND c.user_id = auth.uid()
            )
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- 1.4 UPDATE: (Force Submit, Score Computation, Status Transition)
-- STRICT RULE: Only SUPER_ADMIN can Force Submit (CBT_FORCE_SUBMIT) or modify attempts.
-- Peserta can ONLY update status from IN_PROGRESS to SUBMITTED for their own attempt.
-- PANITIA IS STRICTLY DENIED FROM UPDATING ATTEMPTS!
CREATE POLICY "rbac_exam_attempts_update"
    ON public.exam_attempts FOR UPDATE
    TO authenticated
    USING (
        (
            public.get_auth_role() = 'PESERTA'
            AND EXISTS (
                SELECT 1 FROM public.candidates c
                WHERE c.id = exam_attempts.candidate_id
                  AND c.user_id = auth.uid()
            )
            AND status = 'IN_PROGRESS'::exam_attempt_status_enum
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    )
    WITH CHECK (
        (
            public.get_auth_role() = 'PESERTA'
            AND EXISTS (
                SELECT 1 FROM public.candidates c
                WHERE c.id = exam_attempts.candidate_id
                  AND c.user_id = auth.uid()
            )
            AND status IN ('SUBMITTED'::exam_attempt_status_enum, 'AUTO_SUBMITTED'::exam_attempt_status_enum)
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );

-- 1.5 DELETE: (Reset Attempt - CBT_RESET)
-- STRICT RULE: SUPER_ADMIN ONLY!
-- PANITIA IS STRICTLY DENIED FROM RESETTING/DELETING ATTEMPTS!
CREATE POLICY "rbac_exam_attempts_delete"
    ON public.exam_attempts FOR DELETE
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 2. HARDEN EXAMS RLS (PACKAGE MANAGEMENT)
-- ----------------------------------------------------------------------------
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_exams_select" ON public.exams;
DROP POLICY IF EXISTS "rbac_exams_mutation" ON public.exams;

-- 2.1 SELECT: Super Admin, Panitia (Read-Only for operational schedule checks), Pimpinan
CREATE POLICY "rbac_exams_staff_select"
    ON public.exams FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN')
        OR (public.get_auth_role() = 'PESERTA' AND is_active = true)
    );

-- 2.2 MUTATION (INSERT, UPDATE, DELETE): SUPER_ADMIN ONLY!
-- PANITIA cannot edit duration, total questions, passing score, or toggle active status
CREATE POLICY "rbac_exams_admin_mutation"
    ON public.exams FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 3. HARDEN QUESTIONS & OPTIONS RLS (QUESTION BANK)
-- ----------------------------------------------------------------------------
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_questions_select" ON public.questions;
DROP POLICY IF EXISTS "rbac_questions_mutation" ON public.questions;
DROP POLICY IF EXISTS "rbac_question_options_select" ON public.question_options;
DROP POLICY IF EXISTS "rbac_question_options_mutation" ON public.question_options;

-- 3.1 Questions SELECT: Staff only (PESERTA CANNOT read question bank directly)
CREATE POLICY "rbac_questions_staff_select"
    ON public.questions FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 3.2 Questions MUTATION: SUPER_ADMIN ONLY!
CREATE POLICY "rbac_questions_admin_mutation"
    ON public.questions FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 3.3 Question Options SELECT: Staff only
CREATE POLICY "rbac_question_options_staff_select"
    ON public.question_options FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 3.4 Question Options MUTATION: SUPER_ADMIN ONLY!
CREATE POLICY "rbac_question_options_admin_mutation"
    ON public.question_options FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 4. HARDEN EXAM ANSWERS & EVENTS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rbac_exam_answers_select" ON public.exam_answers;
DROP POLICY IF EXISTS "rbac_exam_answers_mutation" ON public.exam_answers;

-- Staff SELECT answers
CREATE POLICY "rbac_exam_answers_staff_select"
    ON public.exam_answers FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

-- Answers Mutation: Peserta during active attempt, or Super Admin
CREATE POLICY "rbac_exam_answers_mutation"
    ON public.exam_answers FOR ALL
    TO authenticated
    USING (
        (
            public.get_auth_role() = 'PESERTA'
            AND EXISTS (
                SELECT 1 FROM public.exam_attempts ea
                JOIN public.candidates c ON c.id = ea.candidate_id
                WHERE ea.id = exam_answers.attempt_id
                  AND c.user_id = auth.uid()
                  AND ea.status = 'IN_PROGRESS'::exam_attempt_status_enum
                  AND now() <= ea.expires_at
            )
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    )
    WITH CHECK (
        (
            public.get_auth_role() = 'PESERTA'
            AND EXISTS (
                SELECT 1 FROM public.exam_attempts ea
                JOIN public.candidates c ON c.id = ea.candidate_id
                WHERE ea.id = exam_answers.attempt_id
                  AND c.user_id = auth.uid()
                  AND ea.status = 'IN_PROGRESS'::exam_attempt_status_enum
                  AND now() <= ea.expires_at
            )
        )
        OR public.get_auth_role() = 'SUPER_ADMIN'
    );


-- >>> BEGIN FILE: 013_psychotest_scoring_rls.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 013: Psychotest Scoring Config RLS Hardening
-- Enforces SUPER_ADMIN ONLY access to psychotest_scoring_configs
-- Denies SELECT and MUTATION to PANITIA, PIMPINAN, PENGUJI_QURAN, and PESERTA
-- ============================================================================

ALTER TABLE public.psychotest_scoring_configs ENABLE ROW LEVEL SECURITY;

-- Drop prior permissive SELECT policy that allowed PIMPINAN and PANITIA
DROP POLICY IF EXISTS "rbac_psychotest_scoring_select" ON public.psychotest_scoring_configs;
DROP POLICY IF EXISTS "rbac_psychotest_scoring_mutation" ON public.psychotest_scoring_configs;

-- 1. SELECT: Strictly SUPER_ADMIN ONLY
-- PANITIA: DENY
-- PIMPINAN: DENY (Pimpinan accesses aggregate statistics via /pimpinan, not raw scoring weights/keys)
-- PENGUJI_QURAN: DENY
-- PESERTA: DENY
CREATE POLICY "rbac_psychotest_scoring_select"
    ON public.psychotest_scoring_configs FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPER_ADMIN'
    );

-- 2. MUTATION (INSERT, UPDATE, DELETE): Strictly SUPER_ADMIN ONLY
CREATE POLICY "rbac_psychotest_scoring_mutation"
    ON public.psychotest_scoring_configs FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');


-- >>> BEGIN FILE: 014_final_selection_scoring.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 014: Final Selection Scoring, Passing Rules & Quota Engine
-- Deterministic, Immutable, Auditable Multi-component Assessment Integration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCORING VERSIONS & COMPONENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_scoring_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name VARCHAR(150) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2027/2028',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'ARCHIVED')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_scoring_version_name_year UNIQUE (version_name, academic_year)
);

CREATE TABLE IF NOT EXISTS public.selection_scoring_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scoring_version_id UUID NOT NULL REFERENCES public.selection_scoring_versions(id) ON DELETE CASCADE,
    component_code VARCHAR(30) NOT NULL CHECK (component_code IN ('ACADEMIC', 'QURAN', 'PSYCHOTEST')),
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.00 AND weight <= 100.00),
    source_exam_id UUID REFERENCES public.exams(id) ON DELETE RESTRICT,
    source_schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_scoring_version_component UNIQUE (scoring_version_id, component_code)
);

-- ----------------------------------------------------------------------------
-- 2. PASSING RULE VERSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_passing_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name VARCHAR(150) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2027/2028',
    min_academic NUMERIC(6, 2) CHECK (min_academic IS NULL OR (min_academic >= 0.00 AND min_academic <= 100.00)),
    min_quran NUMERIC(6, 2) CHECK (min_quran IS NULL OR (min_quran >= 0.00 AND min_quran <= 100.00)),
    min_psychotest NUMERIC(6, 2) CHECK (min_psychotest IS NULL OR (min_psychotest >= 0.00 AND min_psychotest <= 100.00)),
    min_final_score NUMERIC(6, 2) CHECK (min_final_score IS NULL OR (min_final_score >= 0.00 AND min_final_score <= 100.00)),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'ARCHIVED')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_passing_rule_version_name_year UNIQUE (version_name, academic_year)
);

-- ----------------------------------------------------------------------------
-- 3. TIE BREAKERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_tie_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scoring_version_id UUID REFERENCES public.selection_scoring_versions(id) ON DELETE CASCADE,
    priority INT NOT NULL CHECK (priority >= 1),
    rule_code VARCHAR(50) NOT NULL CHECK (rule_code IN (
        'FINAL_SCORE',
        'ACADEMIC_SCORE',
        'QURAN_SCORE',
        'PSYCHOTEST_SCORE',
        'REGISTRATION_TIMESTAMP'
    )),
    direction VARCHAR(4) NOT NULL DEFAULT 'DESC' CHECK (direction IN ('DESC', 'ASC')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tie_breaker_priority UNIQUE (scoring_version_id, priority)
);

-- ----------------------------------------------------------------------------
-- 4. SELECTION RUNS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year VARCHAR(20) NOT NULL DEFAULT '2027/2028',
    run_name VARCHAR(150) NOT NULL,
    scoring_version_id UUID NOT NULL REFERENCES public.selection_scoring_versions(id) ON DELETE RESTRICT,
    passing_rule_version_id UUID NOT NULL REFERENCES public.selection_passing_rule_versions(id) ON DELETE RESTRICT,
    quota INT NOT NULL CHECK (quota > 0),
    reserve_count INT NOT NULL DEFAULT 0 CHECK (reserve_count >= 0),
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'CALCULATING',
        'CALCULATED',
        'UNDER_REVIEW',
        'APPROVED',
        'SUPERSEDED'
    )),
    candidate_count INT NOT NULL DEFAULT 0,
    complete_count INT NOT NULL DEFAULT 0,
    eligible_count INT NOT NULL DEFAULT 0,
    lulus_count INT NOT NULL DEFAULT 0,
    reserve_count_actual INT NOT NULL DEFAULT 0,
    tidak_lulus_count INT NOT NULL DEFAULT 0,
    tie_pending_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    is_current BOOLEAN NOT NULL DEFAULT false,
    superseded_by_run_id UUID REFERENCES public.selection_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 4.1 SELECTION RUN COMPONENT SNAPSHOTS (Immutable Component Rule Snapshot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_run_component_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_run_id UUID NOT NULL REFERENCES public.selection_runs(id) ON DELETE CASCADE,
    component_code VARCHAR(30) NOT NULL CHECK (component_code IN ('ACADEMIC', 'QURAN', 'PSYCHOTEST')),
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.00 AND weight <= 100.00),
    min_score NUMERIC(6, 2) CHECK (min_score IS NULL OR (min_score >= 0.00 AND min_score <= 100.00)),
    source_exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    source_schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_run_component_snapshot UNIQUE (selection_run_id, component_code)
);

-- ----------------------------------------------------------------------------
-- 5. SELECTION RESULTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_run_id UUID NOT NULL REFERENCES public.selection_runs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE RESTRICT,
    academic_score NUMERIC(8, 4) CHECK (academic_score IS NULL OR (academic_score >= 0.0000 AND academic_score <= 100.0000)),
    quran_score NUMERIC(8, 4) CHECK (quran_score IS NULL OR (quran_score >= 0.0000 AND quran_score <= 100.0000)),
    psychotest_score NUMERIC(8, 4) CHECK (psychotest_score IS NULL OR (psychotest_score >= 0.0000 AND psychotest_score <= 100.0000)),
    final_score NUMERIC(10, 6) CHECK (final_score IS NULL OR (final_score >= 0.000000 AND final_score <= 100.000000)),
    display_final_score VARCHAR(10) NOT NULL DEFAULT '0.00',
    calculation_precision INT NOT NULL DEFAULT 4,
    overall_rank INT CHECK (overall_rank IS NULL OR overall_rank >= 1),
    eligible_rank INT CHECK (eligible_rank IS NULL OR eligible_rank >= 1),
    eligibility_status VARCHAR(25) NOT NULL CHECK (eligibility_status IN (
        'INCOMPLETE',
        'ELIGIBLE',
        'FAILED_COMPONENT',
        'FAILED_FINAL',
        'TIE_PENDING'
    )),
    result_status VARCHAR(25) NOT NULL DEFAULT 'BELUM_DITETAPKAN' CHECK (result_status IN (
        'BELUM_DITETAPKAN',
        'LULUS',
        'CADANGAN',
        'TIDAK_LULUS',
        'TIE_PENDING'
    )),
    failure_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_reason TEXT,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_selection_run_candidate UNIQUE (selection_run_id, candidate_id)
);

-- ----------------------------------------------------------------------------
-- 6. SELECTION RESULT COMPONENTS (Immutable Snapshot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_result_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_result_id UUID NOT NULL REFERENCES public.selection_results(id) ON DELETE CASCADE,
    component_code VARCHAR(30) NOT NULL CHECK (component_code IN ('ACADEMIC', 'QURAN', 'PSYCHOTEST')),
    source_record_id VARCHAR(100) NOT NULL,
    raw_score NUMERIC(8, 4) NOT NULL,
    max_score NUMERIC(8, 4) NOT NULL,
    normalized_score NUMERIC(8, 4) NOT NULL CHECK (normalized_score >= 0.0000 AND normalized_score <= 100.0000),
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.00 AND weight <= 100.00),
    weighted_score NUMERIC(10, 6) NOT NULL,
    source_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_selection_result_component UNIQUE (selection_result_id, component_code)
);

-- ----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_selection_runs_year_status ON public.selection_runs(academic_year, status);
CREATE INDEX IF NOT EXISTS idx_selection_runs_is_current ON public.selection_runs(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_selection_results_run_status ON public.selection_results(selection_run_id, result_status);
CREATE INDEX IF NOT EXISTS idx_selection_results_candidate ON public.selection_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_selection_results_eligible_rank ON public.selection_results(selection_run_id, eligible_rank) WHERE eligible_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_selection_result_components_result ON public.selection_result_components(selection_result_id, component_code);
CREATE INDEX IF NOT EXISTS idx_selection_scoring_components_version ON public.selection_scoring_components(scoring_version_id, component_code);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.selection_scoring_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_scoring_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_passing_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_tie_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_run_component_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_result_components ENABLE ROW LEVEL SECURITY;

-- 8.1 selection_scoring_versions
CREATE POLICY "rbac_scoring_versions_select" ON public.selection_scoring_versions FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_scoring_versions_mutation" ON public.selection_scoring_versions FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.2 selection_scoring_components
CREATE POLICY "rbac_scoring_components_select" ON public.selection_scoring_components FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_scoring_components_mutation" ON public.selection_scoring_components FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.3 selection_passing_rule_versions
CREATE POLICY "rbac_passing_rules_select" ON public.selection_passing_rule_versions FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "rbac_passing_rules_mutation" ON public.selection_passing_rule_versions FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.4 selection_tie_breakers
CREATE POLICY "rbac_tie_breakers_select" ON public.selection_tie_breakers FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "rbac_tie_breakers_mutation" ON public.selection_tie_breakers FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.5 selection_runs
CREATE POLICY "rbac_selection_runs_select" ON public.selection_runs FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_selection_runs_mutation" ON public.selection_runs FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.5.1 selection_run_component_snapshots
CREATE POLICY "rbac_run_component_snapshots_select" ON public.selection_run_component_snapshots FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_run_component_snapshots_mutation" ON public.selection_run_component_snapshots FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.6 selection_results
CREATE POLICY "rbac_selection_results_select" ON public.selection_results FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_selection_results_mutation" ON public.selection_results FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.7 selection_result_components
CREATE POLICY "rbac_selection_result_components_select" ON public.selection_result_components FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_selection_result_components_mutation" ON public.selection_result_components FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');


-- >>> BEGIN FILE: 015_final_selection_rls_hardening.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 015: Strict Least-Privilege RLS Hardening for Final Selection
-- ============================================================================
-- 
-- PRINSIP: STRICT LEAST PRIVILEGE & DEFAULT DENY.
--
-- MATRIX OTORISASI:
-- 1. selection_scoring_versions:        SUPER_ADMIN ONLY (SELECT & MUTATION)
-- 2. selection_scoring_components:      SUPER_ADMIN ONLY (SELECT & MUTATION)
-- 3. selection_passing_rule_versions:    SUPER_ADMIN ONLY (SELECT & MUTATION)
-- 4. selection_tie_breakers:            SUPER_ADMIN ONLY (SELECT & MUTATION)
-- 5. selection_run_component_snapshots: SUPER_ADMIN ONLY (SELECT & MUTATION)
-- 6. selection_runs:                    SUPER_ADMIN (CRUD), PANITIA (SELECT for calculated/review runs only)
-- 7. selection_results:                 SUPER_ADMIN (CRUD), PANITIA (SELECT for review)
-- 8. selection_result_components:       SUPER_ADMIN (CRUD), PANITIA (SELECT for review detail)
--
-- PIMPINAN:     DILARANG direct SELECT ke seluruh tabel konfigurasi dan snapshot internal.
--               Hanya mengakses view/RPC eksekutif teragregasi.
-- PENGUJI_QURAN: DILARANG (DENY) seluruh tabel Final Selection.
-- PESERTA:      DILARANG (DENY) seluruh tabel Final Selection sebelum pengumuman resmi.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDENING: selection_scoring_versions (SUPER_ADMIN ONLY)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_scoring_versions_select" ON public.selection_scoring_versions;
DROP POLICY IF EXISTS "rbac_scoring_versions_mutation" ON public.selection_scoring_versions;

CREATE POLICY "rbac_scoring_versions_select"
    ON public.selection_scoring_versions FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

CREATE POLICY "rbac_scoring_versions_mutation"
    ON public.selection_scoring_versions FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 2. HARDENING: selection_scoring_components (SUPER_ADMIN ONLY)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_scoring_components_select" ON public.selection_scoring_components;
DROP POLICY IF EXISTS "rbac_scoring_components_mutation" ON public.selection_scoring_components;

CREATE POLICY "rbac_scoring_components_select"
    ON public.selection_scoring_components FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

CREATE POLICY "rbac_scoring_components_mutation"
    ON public.selection_scoring_components FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 3. HARDENING: selection_passing_rule_versions (SUPER_ADMIN ONLY)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_passing_rules_select" ON public.selection_passing_rule_versions;
DROP POLICY IF EXISTS "rbac_passing_rules_mutation" ON public.selection_passing_rule_versions;

CREATE POLICY "rbac_passing_rules_select"
    ON public.selection_passing_rule_versions FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

CREATE POLICY "rbac_passing_rules_mutation"
    ON public.selection_passing_rule_versions FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 4. HARDENING: selection_tie_breakers (SUPER_ADMIN ONLY)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_tie_breakers_select" ON public.selection_tie_breakers;
DROP POLICY IF EXISTS "rbac_tie_breakers_mutation" ON public.selection_tie_breakers;

CREATE POLICY "rbac_tie_breakers_select"
    ON public.selection_tie_breakers FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

CREATE POLICY "rbac_tie_breakers_mutation"
    ON public.selection_tie_breakers FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 5. HARDENING: selection_run_component_snapshots (SUPER_ADMIN ONLY)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_run_component_snapshots_select" ON public.selection_run_component_snapshots;
DROP POLICY IF EXISTS "rbac_run_component_snapshots_mutation" ON public.selection_run_component_snapshots;

CREATE POLICY "rbac_run_component_snapshots_select"
    ON public.selection_run_component_snapshots FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN');

CREATE POLICY "rbac_run_component_snapshots_mutation"
    ON public.selection_run_component_snapshots FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 6. HARDENING: selection_runs (SUPER_ADMIN CRUD, PANITIA SELECT ONLY FOR REVIEW)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_selection_runs_select" ON public.selection_runs;
DROP POLICY IF EXISTS "rbac_selection_runs_mutation" ON public.selection_runs;

CREATE POLICY "rbac_selection_runs_select"
    ON public.selection_runs FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() = 'SUPER_ADMIN'
        OR (
            public.get_auth_role() = 'PANITIA'
            AND status IN ('CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED')
        )
    );

CREATE POLICY "rbac_selection_runs_mutation"
    ON public.selection_runs FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 7. HARDENING: selection_results (SUPER_ADMIN CRUD, PANITIA SELECT FOR REVIEW)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_selection_results_select" ON public.selection_results;
DROP POLICY IF EXISTS "rbac_selection_results_mutation" ON public.selection_results;

CREATE POLICY "rbac_selection_results_select"
    ON public.selection_results FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    );

CREATE POLICY "rbac_selection_results_mutation"
    ON public.selection_results FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 8. HARDENING: selection_result_components (SUPER_ADMIN CRUD, PANITIA SELECT FOR REVIEW)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rbac_selection_result_components_select" ON public.selection_result_components;
DROP POLICY IF EXISTS "rbac_selection_result_components_mutation" ON public.selection_result_components;

CREATE POLICY "rbac_selection_result_components_select"
    ON public.selection_result_components FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA')
    );

CREATE POLICY "rbac_selection_result_components_mutation"
    ON public.selection_result_components FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'SUPER_ADMIN')
    WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- 9. SAFE EXECUTIVE VIEW UNTUK PIMPINAN (AGGREGATE ONLY, ZERO CANDIDATE PII / ZERO RANKINGS)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_pimpinan_selection_rankings;
DROP VIEW IF EXISTS public.v_pimpinan_selection_executive;

-- Update status constraint on selection_runs to include SOURCE_AMBIGUOUS
ALTER TABLE public.selection_runs DROP CONSTRAINT IF EXISTS selection_runs_status_check;
ALTER TABLE public.selection_runs ADD CONSTRAINT selection_runs_status_check CHECK (status IN (
    'DRAFT',
    'CALCULATING',
    'CALCULATED',
    'UNDER_REVIEW',
    'APPROVED',
    'SUPERSEDED',
    'SOURCE_AMBIGUOUS'
));

CREATE OR REPLACE VIEW public.v_pimpinan_selection_executive AS
SELECT 
    sr.id AS selection_run_id,
    sr.academic_year,
    sr.run_name,
    sr.status AS run_status,
    sr.quota,
    sr.reserve_count,
    sr.candidate_count AS total_pendaftar,
    sr.complete_count AS nilai_lengkap,
    sr.eligible_count,
    sr.lulus_count,
    sr.reserve_count_actual,
    sr.tidak_lulus_count,
    sr.tie_pending_count,
    ROUND(AVG(r.academic_score), 2) AS avg_academic_score,
    ROUND(AVG(r.quran_score), 2) AS avg_quran_score,
    ROUND(AVG(r.psychotest_score), 2) AS avg_psychotest_score,
    ROUND(AVG(r.final_score), 2) AS avg_final_score,
    sr.approved_at,
    sr.created_at
FROM public.selection_runs sr
LEFT JOIN public.selection_results r ON sr.id = r.selection_run_id
WHERE sr.status = 'APPROVED' AND sr.is_current = true
GROUP BY sr.id, sr.academic_year, sr.run_name, sr.status, sr.quota, sr.reserve_count,
         sr.candidate_count, sr.complete_count, sr.eligible_count, sr.lulus_count,
         sr.reserve_count_actual, sr.tidak_lulus_count, sr.tie_pending_count,
         sr.approved_at, sr.created_at;

-- Grant select ke authenticated role agar dapat diakses oleh Pimpinan
GRANT SELECT ON public.v_pimpinan_selection_executive TO authenticated;


-- >>> BEGIN FILE: 016_pimpinan_strict_rls_hardening.sql <<<

-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 016: Pimpinan Strict Least-Privilege RLS Hardening
-- ============================================================================
-- 
-- PRINSIP KEAMANAN: PIMPINAN = EXECUTIVE AGGREGATE ONLY.
--
-- ATURAN UTAMA:
-- 1. PIMPINAN DILARANG (STRICT DEFAULT DENY) melakukan SELECT individual row dari:
--    - profiles (kecuali record miliknya sendiri)
--    - candidates
--    - candidate_documents
--    - quran_examiner_assignments
--    - quran_assessments
--    - quran_assessment_rubric_snapshots
--    - quran_assessment_scores
--    - exam_attempts
--    - exam_attempt_questions
--    - exam_answers
--    - exam_events
--    - exams
--    - questions
--    - question_options
--    - psychotest_scoring_configs
--    - selection_results
--    - selection_result_components
--    - selection_scoring_versions
--    - selection_scoring_components
--    - selection_passing_rule_versions
--    - selection_tie_breakers
--    - selection_run_component_snapshots
--
-- 2. PIMPINAN DILARANG melihat:
--    - PII santri (nama, NISN, NIK, orang tua, telepon, alamat)
--    - Ranking individual
--    - Nilai santri individual
--    - Failure reason peserta individual
--    - Raw internal scoring configs
--
-- 3. Menggunakan mekanisme AS RESTRICTIVE pada RLS PostgreSQL sehingga policy
--    permisif sebelumnya tidak dapat membuka akses individual row.
--
-- 4. Akses SUPER_ADMIN, PANITIA, PENGUJI_QURAN, dan PESERTA dipertahankan utuh.
--
-- 5. Data eksekutif Pimpinan HANYA dapat diakses melalui view / fungsi teragregasi
--    (v_pimpinan_selection_executive, v_pimpinan_schools_aggregate, get_pimpinan_executive_stats).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RESTRICTIVE POLICY: PROFILES (Kecuali record miliknya sendiri)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_profiles" ON public.profiles;
CREATE POLICY "pimpinan_restrict_profiles"
    ON public.profiles AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() != 'PIMPINAN'
        OR auth.uid() = user_id
    );

-- ----------------------------------------------------------------------------
-- 2. RESTRICTIVE POLICY: CANDIDATES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_candidates" ON public.candidates;
CREATE POLICY "pimpinan_restrict_candidates"
    ON public.candidates AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 3. RESTRICTIVE POLICY: CANDIDATE_DOCUMENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_candidate_documents" ON public.candidate_documents;
CREATE POLICY "pimpinan_restrict_candidate_documents"
    ON public.candidate_documents AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 4. RESTRICTIVE POLICY: QURAN EXAMINER ASSIGNMENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_quran_assignments" ON public.quran_examiner_assignments;
CREATE POLICY "pimpinan_restrict_quran_assignments"
    ON public.quran_examiner_assignments AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 5. RESTRICTIVE POLICY: QURAN ASSESSMENTS & SCORES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_quran_assessments" ON public.quran_assessments;
CREATE POLICY "pimpinan_restrict_quran_assessments"
    ON public.quran_assessments AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_quran_rubric_snapshots" ON public.quran_assessment_rubric_snapshots;
CREATE POLICY "pimpinan_restrict_quran_rubric_snapshots"
    ON public.quran_assessment_rubric_snapshots AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_quran_scores" ON public.quran_assessment_scores;
CREATE POLICY "pimpinan_restrict_quran_scores"
    ON public.quran_assessment_scores AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 6. RESTRICTIVE POLICY: CBT & PSIKOTES EXAM ATTEMPTS & ANSWERS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_exam_attempts" ON public.exam_attempts;
CREATE POLICY "pimpinan_restrict_exam_attempts"
    ON public.exam_attempts AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_exam_attempt_questions" ON public.exam_attempt_questions;
CREATE POLICY "pimpinan_restrict_exam_attempt_questions"
    ON public.exam_attempt_questions AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_exam_answers" ON public.exam_answers;
CREATE POLICY "pimpinan_restrict_exam_answers"
    ON public.exam_answers AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_exam_events" ON public.exam_events;
CREATE POLICY "pimpinan_restrict_exam_events"
    ON public.exam_events AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 7. RESTRICTIVE POLICY: EXAMS & QUESTION BANK
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_exams" ON public.exams;
CREATE POLICY "pimpinan_restrict_exams"
    ON public.exams AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_questions" ON public.questions;
CREATE POLICY "pimpinan_restrict_questions"
    ON public.questions AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_question_options" ON public.question_options;
CREATE POLICY "pimpinan_restrict_question_options"
    ON public.question_options AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 8. RESTRICTIVE POLICY: PSYCHOTEST SCORING CONFIGS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_psychotest_scoring_configs" ON public.psychotest_scoring_configs;
CREATE POLICY "pimpinan_restrict_psychotest_scoring_configs"
    ON public.psychotest_scoring_configs AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 9. RESTRICTIVE POLICY: SELECTION RESULTS & RESULT COMPONENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_selection_results" ON public.selection_results;
CREATE POLICY "pimpinan_restrict_selection_results"
    ON public.selection_results AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_selection_result_components" ON public.selection_result_components;
CREATE POLICY "pimpinan_restrict_selection_result_components"
    ON public.selection_result_components AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 10. RESTRICTIVE POLICY: SELECTION SCORING CONFIGS & SNAPSHOTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pimpinan_restrict_selection_scoring_versions" ON public.selection_scoring_versions;
CREATE POLICY "pimpinan_restrict_selection_scoring_versions"
    ON public.selection_scoring_versions AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_selection_scoring_components" ON public.selection_scoring_components;
CREATE POLICY "pimpinan_restrict_selection_scoring_components"
    ON public.selection_scoring_components AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_selection_passing_rule_versions" ON public.selection_passing_rule_versions;
CREATE POLICY "pimpinan_restrict_selection_passing_rule_versions"
    ON public.selection_passing_rule_versions AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_selection_tie_breakers" ON public.selection_tie_breakers;
CREATE POLICY "pimpinan_restrict_selection_tie_breakers"
    ON public.selection_tie_breakers AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

DROP POLICY IF EXISTS "pimpinan_restrict_selection_run_component_snapshots" ON public.selection_run_component_snapshots;
CREATE POLICY "pimpinan_restrict_selection_run_component_snapshots"
    ON public.selection_run_component_snapshots AS RESTRICTIVE
    FOR SELECT TO authenticated
    USING (public.get_auth_role() != 'PIMPINAN');

-- ----------------------------------------------------------------------------
-- 11. SECURE AGGREGATE VIEWS & RPC FOR PIMPINAN (ZERO CANDIDATE PII)
-- ----------------------------------------------------------------------------

-- View Agregat Asal Sekolah Santri (Pure Aggregate, Zero Personal Info)
CREATE OR REPLACE VIEW public.v_pimpinan_schools_aggregate AS
SELECT 
    COALESCE(NULLIF(TRIM(c.school_name), ''), 'Lainnya') AS school_name,
    COUNT(c.id) AS total_candidates,
    COUNT(CASE WHEN c.status IN ('TERVERIFIKASI', 'DIIZINKAN_MENGIKUTI_SELEKSI', 'MENGIKUTI_SELEKSI', 'SELESAI_SELEKSI', 'LULUS', 'CADANGAN', 'DITERIMA_FINAL', 'DAFTAR_ULANG') THEN 1 END) AS verified_candidates
FROM public.candidates c
GROUP BY COALESCE(NULLIF(TRIM(c.school_name), ''), 'Lainnya')
ORDER BY total_candidates DESC;

GRANT SELECT ON public.v_pimpinan_schools_aggregate TO authenticated;

-- RPC Ringkasan Eksekutif Terisolasi (Security Definer Aggregate Function)
CREATE OR REPLACE FUNCTION public.get_pimpinan_executive_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    stats_data JSONB;
BEGIN
    IF public.get_auth_role() NOT IN ('PIMPINAN', 'SUPER_ADMIN') THEN
        RAISE EXCEPTION 'Akses Ditolak (403 Forbidden): Hanya PIMPINAN dan SUPER_ADMIN yang berwenang mengakses data ringkasan eksekutif.';
    END IF;

    SELECT jsonb_build_object(
        'total_pendaftar', COUNT(*),
        'terverifikasi', COUNT(CASE WHEN status IN ('TERVERIFIKASI', 'DIIZINKAN_MENGIKUTI_SELEKSI', 'MENGIKUTI_SELEKSI', 'SELESAI_SELEKSI', 'LULUS', 'CADANGAN', 'DITERIMA_FINAL', 'DAFTAR_ULANG') THEN 1 END),
        'menunggu_verifikasi', COUNT(CASE WHEN status = 'TERDAFTAR' THEN 1 END),
        'perlu_perbaikan', COUNT(CASE WHEN status = 'PERLU_PERBAIKAN' THEN 1 END),
        'lulus', COUNT(CASE WHEN status IN ('LULUS', 'DITERIMA_FINAL') THEN 1 END),
        'cadangan', COUNT(CASE WHEN status = 'CADANGAN' THEN 1 END),
        'tidak_lulus', COUNT(CASE WHEN status = 'TIDAK_LULUS' THEN 1 END),
        'daftar_ulang', COUNT(CASE WHEN status IN ('DAFTAR_ULANG', 'DITERIMA_FINAL') THEN 1 END)
    ) INTO stats_data
    FROM public.candidates;

    RETURN stats_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pimpinan_executive_stats() TO authenticated;


-- >>> TAMBAHAN: JENIS DOKUMEN BUKTI PEMBAYARAN & PENGATURAN LEMBAGA DINAMIS <<<
INSERT INTO public.document_types (code, name, description, is_required, is_active, max_file_size_mb, allowed_mime_types, sort_order)
VALUES
    ('BUKTI_PEMBAYARAN', 'Bukti Pembayaran Biaya Pendaftaran', 'Scan atau foto bukti transfer biaya infaq pendaftaran PSB.', true, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 7),
    ('BUKTI_DAFTAR_ULANG', 'Bukti Pembayaran Daftar Ulang (Santri Lulus)', 'Scan atau foto bukti transfer daftar ulang bagi calon santri yang dinyatakan LULUS.', false, true, 5, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 8)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_required = EXCLUDED.is_required, is_active = EXCLUDED.is_active;

INSERT INTO public.system_settings (key, value, description)
VALUES
    ('committee_city', 'Surakarta', 'Kota tempat penetapan tanda tangan Kartu Ujian & SKL'),
    ('committee_head_name', 'Ustadz Ridwan Robbani, S.Pd', 'Nama Ketua Panitia PSB'),
    ('committee_head_id', 'NIY. 19890412.201402.1.002', 'NIP / NIY Ketua Panitia PSB'),
    ('bank_name', 'Bank Syariah Indonesia (BSI)', 'Nama Bank Rekening Resmi PSB'),
    ('bank_account_number', '7123456789', 'Nomor Rekening Resmi PSB'),
    ('bank_account_holder', 'Yayasan PPTQM Darul Hikmah', 'Nama Pemilik Rekening Resmi PSB'),
    ('reregistration_fee', '4500000', 'Biaya Daftar Ulang Santri Lulus (Rp)'),
    ('public_demo_controls', 'false', 'Tampilkan tombol Uji Role / Demo ke pengunjung publik (true/false)')
ON CONFLICT (key) DO NOTHING;
