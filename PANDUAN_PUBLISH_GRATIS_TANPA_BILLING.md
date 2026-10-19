# PANDUAN PUBLISH GRATIS (100% TANPA BILLING / KARTU DEBIT)
## Portal PSB Online PPTQM Darul Hikmah TP 2027/2028 (Jenjang SMP)

Dokumen ini menjelaskan hasil identifikasi teknis mengapa proyek sebelumnya meminta pembayaran/kartu debit pada saat akan di-*publish* di Firebase / Google AI Studio, serta langkah-langkah mudah untuk mem-*publish* aplikasi hasil *rebuild* ini secara **100% GRATIS ($0/bulan selamanya)** tanpa perlu memasukkan kartu debit maupun kartu kredit.

---

## 1. Hasil Identifikasi: Mengapa Sebelumnya Wajib Billing / Kartu Debit?

Berdasarkan audit menyeluruh terhadap kode sumber di dalam arsip `psb-pptqm-darul-hikmah-2027_2028 (1).zip`, ditemukan **3 pemicu tagihan (*billing triggers*)** yang menyebabkan sistem menuntut akun **Firebase Blaze Plan (Pay-as-you-go)** atau **Google Cloud Billing**:

1. **Konfigurasi `firebase.json` & Folder `dataconnect/` (Cloud SQL PostgreSQL Berbayar)**
   - Proyek asli menyertakan file `firebase.json` dengan konfigurasi `"dataconnect": { "source": "dataconnect" }` dan file `dataconnect/dataconnect.yaml` yang terhubung ke instance **Google Cloud SQL PostgreSQL** (`psb-darul-hikmah-staging` di region `asia-southeast1`), beserta folder SDK `src/dataconnect-generated/`.
   - Layanan **Firebase Data Connect / Google Cloud SQL** tidak tersedia di paket gratis (Spark Plan) dan **wajib mengaktifkan paket berbayar Blaze Plan dengan kartu debit/kredit**. Padahal di dalam kode utama aplikasi (`src/`), modul `dataconnect` tersebut sama sekali tidak digunakan!
2. **Deklarasi Server-Side di `metadata.json` (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`)**
   - File `metadata.json` mencantumkan kapabilitas `"MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"`. Saat di-*publish* dari AI Studio / Cloud Run, flag ini memicu pembuatan **Container Server-Side (Google Cloud Run)** yang mengharuskan verifikasi akun penagihan (*Cloud Billing Account*).
3. **Dependensi Backend di `package.json` (`express` & `@google/genai`)**
   - Keberadaan paket `express` dan `@google/genai` membuat pendeteksi otomatis menganggap aplikasi membutuhkan server Node.js aktif, padahal seluruh aplikasi PSB ini berjalan 100% di sisi klien (*Client-Side Single-Page Application*).

---

## 2. Apa Saja yang Telah Dibangun Ulang & Diperbaiki?

1. **Pembersihan Total Pemicu Tagihan (100% Zero-Billing)**:
   - Menghapus `firebase.json`, `.firebaserc`, folder `dataconnect/`, dan `src/dataconnect-generated/`.
   - Mengosongkan `majorCapabilities` pada `metadata.json`.
   - Menghapus paket `express`, `@types/express`, `dotenv`, dan `@google/genai` dari `package.json`.
2. **Penambahan Panel "Publish Gratis & Cloud Sync (Tanpa Billing)" di Dalam Aplikasi**:
   - Klik tombol **"Publish Gratis & DB"** di bilah navigasi atas aplikasi untuk membuka pusat kendali database:
     - **Mode Mandiri (Local Relational Engine)**: Langsung berjalan 100% gratis tanpa konfigurasi apapun, dilengkapi tombol **Unduh Backup Database (`.json`)**, **Impor / Restore Database (`.json`)**, dan **Reset Seed**.
     - **Integrasi Google Sheets Gratis (Google Apps Script)**: Mengirim data pendaftar langsung ke Google Spreadsheet panitia menggunakan akun Gmail biasa ($0 tanpa kartu debit).
     - **Koneksi Langsung Supabase Free Tier dari Browser**: Anda dapat menempelkan `Supabase Project URL` dan `Anon Public Key` langsung dari antarmuka web kapan saja tanpa perlu melakukan *build* ulang.
3. **Konfigurasi Siap Pakai untuk 4 Platform Hosting Gratis**:
   - Sudah dilengkapi `vercel.json` (untuk Vercel), `netlify.toml` & `public/_redirects` (untuk Netlify & Cloudflare Pages), serta `.github/workflows/deploy-github-pages.yml` (untuk GitHub Pages).

---

## 3. Cara Publish Gratis Tanpa Kartu Debit / Kredit

### Cara A: Publish Gratis ke Vercel (Rekomendasi Utama — Tanpa Kartu Debit)
1. Buat akun gratis di [vercel.com](https://vercel.com) menggunakan akun GitHub/Email (tidak meminta kartu debit/kredit).
2. Unggah proyek ini ke repositori GitHub Anda.
3. Di dashboard Vercel, klik **Add New... -> Project**, lalu pilih repositori tersebut.
4. Klik **Deploy** (pengaturan *Framework: Vite*, *Build Command: `npm run build`*, dan *Output Directory: `dist`* sudah terdeteksi otomatis dari `vercel.json`).
5. Website PSB Anda langsung online dengan domain `.vercel.app` gratis dan SSL HTTPS otomatis!

### Cara B: Publish Gratis ke Netlify / Netlify Drop (Bisa Tanpa GitHub)
1. Buka [app.netlify.com](https://app.netlify.com) dan daftar akun gratis (tanpa kartu debit).
2. Jika di komputer lokal, jalankan `npm install` lalu `npm run build` hingga menghasilkan folder `dist/`, kemudian seret (*drag-and-drop*) folder `dist/` ke [app.netlify.com/drop](https://app.netlify.com/drop).
3. Atau hubungkan ke repositori GitHub Anda — file `netlify.toml` dan `public/_redirects` sudah disiapkan agar semua rute halaman berfungsi mulus.

### Cara C: Publish Gratis ke Cloudflare Pages (Bandwidth Tanpa Batas)
1. Daftar akun gratis di [pages.cloudflare.com](https://pages.cloudflare.com).
2. Pilih **Create a project -> Connect to Git**, pilih repositori Anda.
3. Pilih preset **Vite** (`npm run build`, direktori output `dist`), lalu klik **Save and Deploy**.

### Cara D: Publish Gratis ke GitHub Pages
1. Unggah seluruh isi proyek ini ke repositori GitHub.
2. Buka menu **Settings -> Pages** di repositori GitHub Anda.
3. Pada bagian **Build and deployment -> Source**, pilih **GitHub Actions**.
4. File `.github/workflows/deploy-github-pages.yml` yang sudah kami sertakan akan otomatis mem-*build* dan men-*deploy* aplikasi Anda secara gratis!
