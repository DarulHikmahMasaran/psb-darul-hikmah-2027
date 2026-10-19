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
