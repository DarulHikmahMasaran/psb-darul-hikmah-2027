-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 007: Landing Page Assets Storage & Logo Management
-- ============================================================================

-- 1. Pastikan kolom logo_path & favicon_path tersedia pada landing_page_settings
ALTER TABLE public.landing_page_settings
ADD COLUMN IF NOT EXISTS logo_path TEXT,
ADD COLUMN IF NOT EXISTS favicon_path TEXT;

-- 2. Buat Storage Bucket Publik untuk Aset CMS Landing Page (Logo & Banner Publik)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'landing-page-assets',
    'landing-page-assets',
    true, -- Bucket publik khusus untuk aset visual landing page
    2097152, -- Maksimal 2 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp'] -- PNG, JPG, WEBP (SVG ditolak demi keamanan)
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Storage RLS Policies untuk landing-page-assets
-- Catatan: Bucket candidate-documents tetap PRIVATE dan TIDAK diubah sama sekali.

-- Policy 1: Siapapun (Publik & Pengunjung Website) dapat membaca/menampilkan logo dari landing-page-assets
DROP POLICY IF EXISTS "Public read landing page assets" ON storage.objects;
CREATE POLICY "Public read landing page assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-page-assets');

-- Policy 2: Hanya SUPER_ADMIN dan PANITIA yang boleh mengunggah logo ke landing-page-assets
DROP POLICY IF EXISTS "Staff upload landing page assets" ON storage.objects;
CREATE POLICY "Staff upload landing page assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
);

-- Policy 3: Hanya SUPER_ADMIN dan PANITIA yang boleh memperbarui logo di landing-page-assets
DROP POLICY IF EXISTS "Staff update landing page assets" ON storage.objects;
CREATE POLICY "Staff update landing page assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
)
WITH CHECK (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
);

-- Policy 4: Hanya SUPER_ADMIN dan PANITIA yang boleh menghapus logo lama di landing-page-assets
DROP POLICY IF EXISTS "Staff delete landing page assets" ON storage.objects;
CREATE POLICY "Staff delete landing page assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'landing-page-assets'
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA')
);
