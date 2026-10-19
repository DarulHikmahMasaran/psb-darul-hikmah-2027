# SISTEM PENERIMAAN SANTRI BARU (PSB) ONLINE
## PONDOK PESANTREN TAHFIDZUL QUR'AN MODERN (PPTQM) DARUL HIKMAH
### TAHUN PELAJARAN 2027/2028 (JENJANG SMP)

Aplikasi web portal Penerimaan Santri Baru (PSB) production-ready untuk calon santri jenjang SMP (lulusan/siswa kelas 6 SD/MI), dibangun dengan standar arsitektur modular, keamanan ketat, serta integrasi PostgreSQL & Supabase.

---

## 1. STRUKTUR FOLDER & ARSITEKTUR

```text
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # DDL, UUID PK, RLS Policies, Indexes, DB Sequence
│   └── seeds/
│       └── 001_seed_data.sql          # Inisialisasi system_settings & panduan akun admin/panitia
├── src/
│   ├── components/                    # Reusable UI Components
│   │   ├── Alert.tsx                  # Pesan status info, success, warning, error
│   │   ├── Badge.tsx                  # Label status (DRAFT, TERDAFTAR, dsb.) & role badge
│   │   ├── Button.tsx                 # Button varian, ukuran, state loading & ikon
│   │   ├── DatabaseGuideModal.tsx     # Modal status Supabase, SQL viewer & switcher akun
│   │   ├── EmptyState.tsx             # State visual saat data kosong
│   │   ├── Footer.tsx                 # Profil lembaga, program unggulan, kontak
│   │   ├── Input.tsx                  # Text/number/date input dengan error validasi
│   │   ├── Loading.tsx                # Spinner & skeleton loader
│   │   ├── Modal.tsx                  # Dialog modal aksesibel
│   │   ├── Navbar.tsx                 # Navigasi responsif, role badge & menu drawer
│   │   ├── Pagination.tsx             # Paginasi tabel pendaftar
│   │   ├── Select.tsx                 # Dropdown select form
│   │   └── Table.tsx                  # Tabel data pendaftar & audit log
│   ├── hooks/
│   │   └── useAuth.tsx                # Auth context & hook manajemen sesi, role, dan demo
│   ├── lib/
│   │   ├── storage.ts                 # Local relational engine & sinkronisasi fallback
│   │   └── supabase.ts                # Client Supabase (@supabase/supabase-js) & config
│   ├── pages/
│   │   ├── AdminAuditLogsPage.tsx     # Panel riwayat mutasi & audit logs
│   │   ├── AdminDashboardPage.tsx     # Dashboard verifikasi pendaftar & statistik
│   │   ├── AdminSettingsPage.tsx      # Manajemen system_settings PSB
│   │   ├── ForgotPasswordPage.tsx     # Pemulihan kata sandi
│   │   ├── LandingPage.tsx            # Halaman utama PSB (Hero, Alur, Jadwal, FAQ, Kontak)
│   │   ├── LoginPage.tsx              # Form login akun pendaftar / panitia
│   │   ├── PesertaBiodataPage.tsx     # Formulir 6 bagian (Simpan Draft & Submit Final)
│   │   ├── PesertaDashboardPage.tsx   # Dashboard peserta, progress pendaftaran & riwayat
│   │   └── RegisterPage.tsx           # Registrasi akun + auto-generate nomor pendaftaran
│   ├── services/
│   │   ├── auditService.ts            # Pencatatan audit trail (audit_logs)
│   │   ├── authService.ts             # Registrasi, login, logout, sesi pengguna
│   │   ├── candidateService.ts        # CRUD calon santri, verifikasi, history status
│   │   └── settingsService.ts         # Konfigurasi tahun pelajaran, kuota & kontak
│   ├── types/
│   │   ├── auth.ts                    # Tipe data autentikasi & request payload
│   │   └── database.ts                # Tipe schema profiles, candidates, status, audit
│   ├── utils/
│   │   ├── formatters.ts              # Format tanggal Indonesia & mata uang
│   │   ├── progress.ts                # Kalkulasi persentase kelengkapan biodata
│   │   └── validation.ts              # Validasi NIK 16 digit, NISN 10 digit, email, nomor WA
│   ├── App.tsx                        # Root Router & Role Protection Middleware
│   ├── index.css                      # Tailwind CSS v4 entry point
│   └── main.tsx                       # Entry point React
├── .env.example                       # Contoh environment variables
├── index.html                         # Entry HTML berstandar SEO & meta tag
├── metadata.json                      # Metadata AI Studio
├── package.json                       # Dependencies & scripts
└── tsconfig.json                      # Konfigurasi TypeScript
```

---

## 2. ENVIRONMENT VARIABLES (CLIENT-SAFE)

Konfigurasikan pada file `.env` di direktori root aplikasi (Vite):

```env
# URL dan Kunci Publik Supabase (Dapatkan dari Supabase Dashboard -> Project Settings -> API)
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"

# Host URL aplikasi
APP_URL="http://localhost:3000"
```

> **PERATURAN KEAMANAN KRUSIAL:**
> `SUPABASE_SERVICE_ROLE_KEY` **TIDAK PERNAH** dimasukkan ke `.env` client, tidak digunakan di browser, tidak disimpan di localStorage/sessionStorage, dan tidak pernah ditampilkan di UI. Client hanya menggunakan URL dan Anon/Public Key bersama Supabase Row Level Security (RLS).

---

## 3. SKEMA DATABASE & SQL MIGRATION

File migrasi lengkap tersedia pada:
`/database/migrations/001_initial_schema.sql`

Tabel yang dibuat:
1. `profiles`: Terhubung dengan `auth.users` (`user_id UUID UNIQUE`), menyimpan `role` (`SUPER_ADMIN`, `PANITIA`, `PENGUJI_QURAN`, `PIMPINAN`, `PESERTA`), nama, telepon, dan status aktif.
2. `candidates`: Menyimpan data komprehensif calon santri (data pribadi, NIK, NISN, sekolah asal, alamat lengkap, data orang tua/wali, data kependudukan).
3. `candidate_status_history`: Menyimpan audit trail setiap perubahan status dari `DRAFT` hingga `DITERIMA_FINAL` dengan pencatat waktu dan alasan perubahan.
4. `system_settings`: Konfigurasi tahun pelajaran (`psb_year = '2027/2028'`), kuota (`120`), jadwal, dan hotline panitia.
5. `audit_logs`: Mencatat aktivitas pengguna (`login`, `update_biodata`, `verifikasi`, `ubah_setting`).

### Penomoran Otomatis Server/Database
Nomor pendaftaran di-generate menggunakan sequence database PostgreSQL:
```sql
CREATE SEQUENCE IF NOT EXISTS public.registration_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('public.registration_number_seq');
    RETURN 'DH-2027-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$;
```
Menghasilkan nomor unik seperti: `DH-2027-0001`, `DH-2027-0002`, `DH-2027-0003` tanpa risiko duplikasi saat banyak peserta mendaftar bersamaan.

### Keamanan Row Level Security (RLS)
- Peserta **hanya dapat membaca** data profil dan record `candidates` miliknya sendiri.
- Peserta **hanya dapat memperbarui** data santri jika status masih `DRAFT` atau `PERLU_PERBAIKAN`.
- Peserta **tidak dapat mengubah status** secara semena-mena.
- Panitia & Super Admin memiliki akses SELECT dan UPDATE untuk keperluan verifikasi.

---

## 4. INSTRUKSI MENJALANKAN PROJECT

### Prasyarat
- Node.js versi 18+ atau 20+
- npm atau pnpm atau yarn

### Langkah Instalasi
```bash
# 1. Pasang dependensi
npm install

# 2. Salin template konfigurasi environment
cp .env.example .env

# 3. Jalankan server pengembangan lokal (Port 3000)
npm run dev
```

Buka peramban di `http://localhost:3000`.

---

## 5. INSTRUKSI MEMBUAT AKUN ADMIN & PANITIA

Akun siap pakai yang sudah ter-seed untuk keperluan pengujian lokal:
- **Super Admin:**
  - Email: `admin@darulhikmah.sch.id`
  - Sandi: `Password123!`
  - Role: `SUPER_ADMIN`
- **Panitia Verifikasi:**
  - Email: `panitia@darulhikmah.sch.id`
  - Sandi: `Password123!`
  - Role: `PANITIA`
- **Peserta Contoh (Santri Farhan):**
  - Email: `farhan@example.com`
  - Sandi: `Password123!`
  - Role: `PESERTA` (No. Reg: `DH-2027-0001`)

### Menambahkan Admin / Panitia di Supabase Auth
1. Buka dashboard proyek Supabase Anda -> menu **Authentication** -> **Users**.
2. Klik **Add User** -> **Create User**.
3. Masukkan email (misal: `panitiapsb@darulhikmah.sch.id`) dan password yang aman.
4. Buka menu **SQL Editor** di Supabase, lalu jalankan perintah:
```sql
INSERT INTO public.profiles (user_id, full_name, email, phone, role, is_active)
SELECT 
    id, 
    'Ustadz Panitia Baru, S.Pd', 
    'panitiapsb@darulhikmah.sch.id', 
    '081234567890', 
    'PANITIA'::user_role, 
    true
FROM auth.users 
WHERE email = 'panitiapsb@darulhikmah.sch.id'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'PANITIA'::user_role;
```

---

## 6. FITUR UTAMA TAHAP PERTAMA

1. **Landing Page Interaktif:**
   - Hero section resmi TP 2027/2028 jenjang SMP.
   - Profil pesantren, program tahfidz 30 juz, dwi bahasa (Arab & Inggris).
   - Persyaratan umum & berkas administrasi.
   - 6 Tahapan alur seleksi pendaftaran online.
   - Jadwal agenda pendaftaran, verifikasi, tes, dan pengumuman.
   - FAQ interaktif (accordion) dan hotline WhatsApp resmi.
2. **Autentikasi & Registrasi:**
   - Formulir pendaftaran akun calon santri dengan validasi email, telepon, dan password min 8 karakter.
   - Penerbitan otomatis nomor registrasi unik `DH-2027-0001`, `DH-2027-0002`, dst.
   - Halaman lupa kata sandi.
3. **Dashboard Peserta:**
   - Progress bar kelengkapan biodata (%) dan dokumen.
   - Status pendaftaran dengan badge warna dinamis (`DRAFT`, `TERDAFTAR`, `PERLU_PERBAIKAN`, `TERVERIFIKASI`).
   - Riwayat perjalanan pendaftaran (timeline perubahan status beserta catatan panitia).
   - Tombol cetak bukti pendaftaran.
4. **Formulir Biodata Santri (6 Bagian):**
   - Data Pribadi (Nama, NIK 16 digit, NISN 10 digit, TTL, Jenis Kelamin, Agama).
   - Data Sekolah Asal (Nama SD/MI, NPSN, NIS).
   - Alamat Lengkap Sesuai KK.
   - Data Orang Tua Kandung (Ayah & Ibu).
   - Data Wali (jika santri tidak bersama orang tua kandung).
   - Data Kependudukan Tambahan (Anak ke-, jumlah saudara, status tinggal).
   - Fitur **"Simpan Draft"** (bebas simpan bertahap tanpa validasi ketat).
   - Fitur **"Kirim Formulir Final"** (validasi kolom wajib lengkap dengan notifikasi ramah).
5. **Dashboard Panitia & Admin:**
   - Statistik real-time: Total Pendaftar, Draft, Terdaftar, Perlu Perbaikan, Terverifikasi, Siap Tes Seleksi.
   - Pencarian berdasarkan nomor registrasi, nama, NISN, atau asal sekolah.
   - Filter pendaftar berdasarkan status.
   - Modal detail data santri & fungsi verifikasi berkas:
     - Mengubah status ke `TERVERIFIKASI`, `PERLU_PERBAIKAN` (disertai catatan perbaikan wajib bagi santri), `DIIZINKAN_MENGIKUTI_SELEKSI`, dsb.
     - Setiap perubahan otomatis tercatat ke `candidate_status_history` dan `audit_logs`.
6. **Catatan Audit (Audit Trail):**
   - Halaman `/admin/audit-logs` merekam aktivitas login, registrasi, simpan draft, kirim final, dan verifikasi panitia.
7. **Pengaturan Sistem (system_settings):**
   - Halaman `/admin/settings` untuk mengubah konfigurasi tahun pelajaran, kuota, tanggal tes, dan hotline tanpa mengubah source code.
8. **Proteksi Route & Middleware:**
   - Akses `/admin/*` otomatis diarahkan ke login jika belum masuk atau ditolak jika role adalah `PESERTA`.
   - Akses `/peserta/*` diproteksi untuk calon santri terdaftar.
9. **Desain Mobile-First & Responsif:**
   - Dioptimalkan khusus untuk layar ponsel pintar wali murid yang mendaftar dari smartphone, tablet, maupun laptop.

---

## 7. INSTRUKSI DEPLOYMENT

### Build Produksi
```bash
npm run build
```
Hasil build akan berada pada folder `dist/`.

### Deployment ke Vercel / Cloudflare Pages / Cloud Run
1. Hubungkan repository ke platform hosting pilihan.
2. Atur Environment Variables di dashboard hosting:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Perintah Build: `npm run build`
4. Output Directory: `dist`
