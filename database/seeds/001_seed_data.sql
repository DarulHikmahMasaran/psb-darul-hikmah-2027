-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Seed Data 001: Initial System Settings & Seed Accounts
-- ============================================================================

-- 1. Insert Initial System Settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
    ('psb_year', '2027/2028', 'Tahun Pelajaran Penerimaan Santri Baru'),
    ('school_name', 'PPTQM Darul Hikmah', 'Nama Pondok Pesantren Tahfidzul Quran Modern'),
    ('school_level', 'SMP (Sekolah Menengah Pertama)', 'Jenjang pendidikan yang dibuka'),
    ('registration_batch', 'Gelombang 1', 'Gelombang pendaftaran yang sedang aktif'),
    ('registration_start_date', '2026-10-01', 'Tanggal mulai pendaftaran santri baru'),
    ('registration_end_date', '2026-12-31', 'Batas akhir pendaftaran santri baru'),
    ('test_date', '2027-01-10', 'Tanggal pelaksanaan tes seleksi santri baru'),
    ('announcement_date', '2027-01-20', 'Tanggal pengumuman hasil seleksi'),
    ('contact_wa', '+62 812-3456-7890', 'Nomor WhatsApp Helpdesk Panitia PSB'),
    ('contact_email', 'psb@darulhikmah.sch.id', 'Email resmi panitia penerimaan santri'),
    ('target_quota', '120', 'Target kuota santri baru (Putra & Putri)'),
    ('registration_fee', '350000', 'Biaya infaq pendaftaran & administrasi (Rp)')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- 2. Panduan & SQL Seed Akun Super Admin & Panitia
-- Catatan Keamanan: Supabase Auth mengenkripsi kata sandi menggunakan bcrypt di schema auth.users.
-- Cara 1 (Direkomendasikan): Daftarkan email melalui auth UI Supabase, lalu jalankan query di bawah untuk meng-upgrade role:
/*
-- Setelah user terdaftar di Supabase Auth:
-- Update user menjadi SUPER_ADMIN:
INSERT INTO public.profiles (user_id, full_name, email, phone, role, is_active)
SELECT 
    id, 
    'Super Admin PSB Darul Hikmah', 
    'admin@darulhikmah.sch.id', 
    '081234567890', 
    'SUPER_ADMIN'::user_role, 
    true
FROM auth.users 
WHERE email = 'admin@darulhikmah.sch.id'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'SUPER_ADMIN'::user_role;

-- Update user menjadi PANITIA:
INSERT INTO public.profiles (user_id, full_name, email, phone, role, is_active)
SELECT 
    id, 
    'Ustadz Rahmat Panitia PSB', 
    'panitia@darulhikmah.sch.id', 
    '081298765432', 
    'PANITIA'::user_role, 
    true
FROM auth.users 
WHERE email = 'panitia@darulhikmah.sch.id'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'PANITIA'::user_role;
*/
