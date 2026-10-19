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
