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
