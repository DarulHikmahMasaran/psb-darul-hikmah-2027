-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 008: Bottom Call-To-Action (CTA) Settings
-- ============================================================================

ALTER TABLE public.landing_page_settings
ADD COLUMN IF NOT EXISTS cta_title TEXT,
ADD COLUMN IF NOT EXISTS cta_description TEXT,
ADD COLUMN IF NOT EXISTS cta_primary_button_text TEXT DEFAULT 'Daftar Sekarang',
ADD COLUMN IF NOT EXISTS cta_primary_button_link TEXT DEFAULT '/register',
ADD COLUMN IF NOT EXISTS cta_primary_button_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cta_secondary_button_text TEXT DEFAULT 'Hubungi Panitia',
ADD COLUMN IF NOT EXISTS cta_secondary_button_link TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS cta_secondary_button_active BOOLEAN DEFAULT true;
