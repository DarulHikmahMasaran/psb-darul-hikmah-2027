-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 005: Landing Page CMS (Content Management System)
-- Versioning, Draft & Review Workflow, Public Schedule Integration & RLS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE cms_version_status AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cms_contact_type AS ENUM ('WHATSAPP', 'INSTAGRAM', 'EMAIL', 'WEBSITE', 'ALAMAT', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cms_requirement_category AS ENUM ('UMUM', 'BERKAS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. LANDING PAGE SETTINGS (Singleton config)
CREATE TABLE IF NOT EXISTS public.landing_page_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL,
    site_short_name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    program_label TEXT NOT NULL,
    logo_path TEXT,
    favicon_path TEXT,
    hero_badge TEXT NOT NULL,
    hero_title TEXT NOT NULL,
    hero_highlight TEXT NOT NULL,
    hero_subtitle TEXT,
    hero_description TEXT NOT NULL,
    hero_primary_button_text TEXT NOT NULL,
    hero_primary_button_link TEXT NOT NULL,
    hero_secondary_button_text TEXT NOT NULL,
    hero_secondary_button_link TEXT NOT NULL,
    meta_title TEXT,
    meta_description TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LANDING PAGE STATS (Statistik Beranda)
CREATE TABLE IF NOT EXISTS public.landing_page_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. LANDING PAGE REQUIREMENTS (Persyaratan Pendaftaran)
CREATE TABLE IF NOT EXISTS public.landing_page_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category cms_requirement_category NOT NULL DEFAULT 'UMUM',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. LANDING PAGE STEPS (Alur Seleksi & Pendaftaran)
CREATE TABLE IF NOT EXISTS public.landing_page_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LANDING PAGE SCHEDULES (Agenda Kegiatan Publik)
CREATE TABLE IF NOT EXISTS public.landing_page_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date_text TEXT NOT NULL,
    badge_color TEXT NOT NULL DEFAULT 'emerald',
    test_schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. LANDING PAGE FAQS (Tanya Jawab / Accordion)
CREATE TABLE IF NOT EXISTS public.landing_page_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. LANDING PAGE CONTACTS & SOCIAL MEDIA
CREATE TABLE IF NOT EXISTS public.landing_page_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_type cms_contact_type NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    link TEXT,
    icon_key TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LANDING PAGE ANNOUNCEMENTS (Banner Beranda dengan Rentang Waktu)
CREATE TABLE IF NOT EXISTS public.landing_page_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    button_text TEXT,
    button_link TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. LANDING PAGE VERSIONS (Audit Snapshot, Draft, Publish & Rollback)
CREATE TABLE IF NOT EXISTS public.landing_page_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INT NOT NULL,
    content_snapshot JSONB NOT NULL,
    status cms_version_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES auth.users(id),
    published_by_name TEXT,
    published_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cms_versions_status ON public.landing_page_versions(status);
CREATE INDEX IF NOT EXISTS idx_cms_versions_num ON public.landing_page_versions(version_number DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;

-- PUBLIC & PESERTA: Read-only access to published content
CREATE POLICY "Public read published versions" ON public.landing_page_versions
    FOR SELECT USING (status = 'PUBLISHED');

CREATE POLICY "Public read landing settings" ON public.landing_page_settings
    FOR SELECT USING (true);

CREATE POLICY "Public read active stats" ON public.landing_page_stats
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active requirements" ON public.landing_page_requirements
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active steps" ON public.landing_page_steps
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active public schedules" ON public.landing_page_schedules
    FOR SELECT USING (is_active = true AND is_public = true);

CREATE POLICY "Public read active faqs" ON public.landing_page_faqs
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active contacts" ON public.landing_page_contacts
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active announcements" ON public.landing_page_announcements
    FOR SELECT USING (
        is_active = true 
        AND (start_at IS NULL OR start_at <= NOW()) 
        AND (end_at IS NULL OR end_at >= NOW())
    );

-- STAFF (PANITIA, PIMPINAN, SUPER_ADMIN): Read all draft & active rows
CREATE POLICY "Staff read all cms versions" ON public.landing_page_versions
    FOR SELECT USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PIMPINAN'));

CREATE POLICY "Panitia create and edit draft versions" ON public.landing_page_versions
    FOR INSERT WITH CHECK (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
        AND status IN ('DRAFT', 'REVIEW')
    );

CREATE POLICY "Panitia update draft versions" ON public.landing_page_versions
    FOR UPDATE USING (
        (public.get_current_user_role() = 'PANITIA' AND status IN ('DRAFT', 'REVIEW'))
        OR public.get_current_user_role() = 'SUPER_ADMIN'
        OR (public.get_current_user_role() = 'PIMPINAN' AND status = 'REVIEW')
    );

-- SUPER_ADMIN & PIMPINAN: Publish permissions
CREATE POLICY "Super admin and pimpinan publish versions" ON public.landing_page_versions
    FOR UPDATE USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'PIMPINAN')
    );

-- Content tables write permissions (Staff manage drafts/content)
CREATE POLICY "Staff manage landing settings" ON public.landing_page_settings
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage stats" ON public.landing_page_stats
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage requirements" ON public.landing_page_requirements
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage steps" ON public.landing_page_steps
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage schedules" ON public.landing_page_schedules
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage faqs" ON public.landing_page_faqs
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage contacts" ON public.landing_page_contacts
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

CREATE POLICY "Staff manage announcements" ON public.landing_page_announcements
    FOR ALL USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));
