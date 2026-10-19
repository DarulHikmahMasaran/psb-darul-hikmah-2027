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
