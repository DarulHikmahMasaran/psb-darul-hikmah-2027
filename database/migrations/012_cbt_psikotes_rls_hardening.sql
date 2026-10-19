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
