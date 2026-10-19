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
