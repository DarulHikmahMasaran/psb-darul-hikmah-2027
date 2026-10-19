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
