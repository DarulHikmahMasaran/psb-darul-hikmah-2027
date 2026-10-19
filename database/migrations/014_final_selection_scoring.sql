-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 014: Final Selection Scoring, Passing Rules & Quota Engine
-- Deterministic, Immutable, Auditable Multi-component Assessment Integration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCORING VERSIONS & COMPONENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_scoring_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name VARCHAR(150) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2027/2028',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'ARCHIVED')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_scoring_version_name_year UNIQUE (version_name, academic_year)
);

CREATE TABLE IF NOT EXISTS public.selection_scoring_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scoring_version_id UUID NOT NULL REFERENCES public.selection_scoring_versions(id) ON DELETE CASCADE,
    component_code VARCHAR(30) NOT NULL CHECK (component_code IN ('ACADEMIC', 'QURAN', 'PSYCHOTEST')),
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.00 AND weight <= 100.00),
    source_exam_id UUID REFERENCES public.exams(id) ON DELETE RESTRICT,
    source_schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_scoring_version_component UNIQUE (scoring_version_id, component_code)
);

-- ----------------------------------------------------------------------------
-- 2. PASSING RULE VERSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_passing_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name VARCHAR(150) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2027/2028',
    min_academic NUMERIC(6, 2) CHECK (min_academic IS NULL OR (min_academic >= 0.00 AND min_academic <= 100.00)),
    min_quran NUMERIC(6, 2) CHECK (min_quran IS NULL OR (min_quran >= 0.00 AND min_quran <= 100.00)),
    min_psychotest NUMERIC(6, 2) CHECK (min_psychotest IS NULL OR (min_psychotest >= 0.00 AND min_psychotest <= 100.00)),
    min_final_score NUMERIC(6, 2) CHECK (min_final_score IS NULL OR (min_final_score >= 0.00 AND min_final_score <= 100.00)),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'ARCHIVED')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_passing_rule_version_name_year UNIQUE (version_name, academic_year)
);

-- ----------------------------------------------------------------------------
-- 3. TIE BREAKERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_tie_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scoring_version_id UUID REFERENCES public.selection_scoring_versions(id) ON DELETE CASCADE,
    priority INT NOT NULL CHECK (priority >= 1),
    rule_code VARCHAR(50) NOT NULL CHECK (rule_code IN (
        'FINAL_SCORE',
        'ACADEMIC_SCORE',
        'QURAN_SCORE',
        'PSYCHOTEST_SCORE',
        'REGISTRATION_TIMESTAMP'
    )),
    direction VARCHAR(4) NOT NULL DEFAULT 'DESC' CHECK (direction IN ('DESC', 'ASC')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tie_breaker_priority UNIQUE (scoring_version_id, priority)
);

-- ----------------------------------------------------------------------------
-- 4. SELECTION RUNS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year VARCHAR(20) NOT NULL DEFAULT '2027/2028',
    run_name VARCHAR(150) NOT NULL,
    scoring_version_id UUID NOT NULL REFERENCES public.selection_scoring_versions(id) ON DELETE RESTRICT,
    passing_rule_version_id UUID NOT NULL REFERENCES public.selection_passing_rule_versions(id) ON DELETE RESTRICT,
    quota INT NOT NULL CHECK (quota > 0),
    reserve_count INT NOT NULL DEFAULT 0 CHECK (reserve_count >= 0),
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'CALCULATING',
        'CALCULATED',
        'UNDER_REVIEW',
        'APPROVED',
        'SUPERSEDED'
    )),
    candidate_count INT NOT NULL DEFAULT 0,
    complete_count INT NOT NULL DEFAULT 0,
    eligible_count INT NOT NULL DEFAULT 0,
    lulus_count INT NOT NULL DEFAULT 0,
    reserve_count_actual INT NOT NULL DEFAULT 0,
    tidak_lulus_count INT NOT NULL DEFAULT 0,
    tie_pending_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    is_current BOOLEAN NOT NULL DEFAULT false,
    superseded_by_run_id UUID REFERENCES public.selection_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 4.1 SELECTION RUN COMPONENT SNAPSHOTS (Immutable Component Rule Snapshot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_run_component_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_run_id UUID NOT NULL REFERENCES public.selection_runs(id) ON DELETE CASCADE,
    component_code VARCHAR(30) NOT NULL CHECK (component_code IN ('ACADEMIC', 'QURAN', 'PSYCHOTEST')),
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.00 AND weight <= 100.00),
    min_score NUMERIC(6, 2) CHECK (min_score IS NULL OR (min_score >= 0.00 AND min_score <= 100.00)),
    source_exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    source_schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_run_component_snapshot UNIQUE (selection_run_id, component_code)
);

-- ----------------------------------------------------------------------------
-- 5. SELECTION RESULTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_run_id UUID NOT NULL REFERENCES public.selection_runs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE RESTRICT,
    academic_score NUMERIC(8, 4) CHECK (academic_score IS NULL OR (academic_score >= 0.0000 AND academic_score <= 100.0000)),
    quran_score NUMERIC(8, 4) CHECK (quran_score IS NULL OR (quran_score >= 0.0000 AND quran_score <= 100.0000)),
    psychotest_score NUMERIC(8, 4) CHECK (psychotest_score IS NULL OR (psychotest_score >= 0.0000 AND psychotest_score <= 100.0000)),
    final_score NUMERIC(10, 6) CHECK (final_score IS NULL OR (final_score >= 0.000000 AND final_score <= 100.000000)),
    display_final_score VARCHAR(10) NOT NULL DEFAULT '0.00',
    calculation_precision INT NOT NULL DEFAULT 4,
    overall_rank INT CHECK (overall_rank IS NULL OR overall_rank >= 1),
    eligible_rank INT CHECK (eligible_rank IS NULL OR eligible_rank >= 1),
    eligibility_status VARCHAR(25) NOT NULL CHECK (eligibility_status IN (
        'INCOMPLETE',
        'ELIGIBLE',
        'FAILED_COMPONENT',
        'FAILED_FINAL',
        'TIE_PENDING'
    )),
    result_status VARCHAR(25) NOT NULL DEFAULT 'BELUM_DITETAPKAN' CHECK (result_status IN (
        'BELUM_DITETAPKAN',
        'LULUS',
        'CADANGAN',
        'TIDAK_LULUS',
        'TIE_PENDING'
    )),
    failure_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_reason TEXT,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_selection_run_candidate UNIQUE (selection_run_id, candidate_id)
);

-- ----------------------------------------------------------------------------
-- 6. SELECTION RESULT COMPONENTS (Immutable Snapshot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selection_result_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_result_id UUID NOT NULL REFERENCES public.selection_results(id) ON DELETE CASCADE,
    component_code VARCHAR(30) NOT NULL CHECK (component_code IN ('ACADEMIC', 'QURAN', 'PSYCHOTEST')),
    source_record_id VARCHAR(100) NOT NULL,
    raw_score NUMERIC(8, 4) NOT NULL,
    max_score NUMERIC(8, 4) NOT NULL,
    normalized_score NUMERIC(8, 4) NOT NULL CHECK (normalized_score >= 0.0000 AND normalized_score <= 100.0000),
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.00 AND weight <= 100.00),
    weighted_score NUMERIC(10, 6) NOT NULL,
    source_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_selection_result_component UNIQUE (selection_result_id, component_code)
);

-- ----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_selection_runs_year_status ON public.selection_runs(academic_year, status);
CREATE INDEX IF NOT EXISTS idx_selection_runs_is_current ON public.selection_runs(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_selection_results_run_status ON public.selection_results(selection_run_id, result_status);
CREATE INDEX IF NOT EXISTS idx_selection_results_candidate ON public.selection_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_selection_results_eligible_rank ON public.selection_results(selection_run_id, eligible_rank) WHERE eligible_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_selection_result_components_result ON public.selection_result_components(selection_result_id, component_code);
CREATE INDEX IF NOT EXISTS idx_selection_scoring_components_version ON public.selection_scoring_components(scoring_version_id, component_code);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.selection_scoring_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_scoring_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_passing_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_tie_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_run_component_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_result_components ENABLE ROW LEVEL SECURITY;

-- 8.1 selection_scoring_versions
CREATE POLICY "rbac_scoring_versions_select" ON public.selection_scoring_versions FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_scoring_versions_mutation" ON public.selection_scoring_versions FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.2 selection_scoring_components
CREATE POLICY "rbac_scoring_components_select" ON public.selection_scoring_components FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_scoring_components_mutation" ON public.selection_scoring_components FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.3 selection_passing_rule_versions
CREATE POLICY "rbac_passing_rules_select" ON public.selection_passing_rule_versions FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "rbac_passing_rules_mutation" ON public.selection_passing_rule_versions FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.4 selection_tie_breakers
CREATE POLICY "rbac_tie_breakers_select" ON public.selection_tie_breakers FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "rbac_tie_breakers_mutation" ON public.selection_tie_breakers FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.5 selection_runs
CREATE POLICY "rbac_selection_runs_select" ON public.selection_runs FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_selection_runs_mutation" ON public.selection_runs FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.5.1 selection_run_component_snapshots
CREATE POLICY "rbac_run_component_snapshots_select" ON public.selection_run_component_snapshots FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_run_component_snapshots_mutation" ON public.selection_run_component_snapshots FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.6 selection_results
CREATE POLICY "rbac_selection_results_select" ON public.selection_results FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_selection_results_mutation" ON public.selection_results FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');

-- 8.7 selection_result_components
CREATE POLICY "rbac_selection_result_components_select" ON public.selection_result_components FOR SELECT TO authenticated
USING (public.get_auth_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "rbac_selection_result_components_mutation" ON public.selection_result_components FOR ALL TO authenticated
USING (public.get_auth_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_auth_role() = 'SUPER_ADMIN');
