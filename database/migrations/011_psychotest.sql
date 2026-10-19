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
