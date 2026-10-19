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
