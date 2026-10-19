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
