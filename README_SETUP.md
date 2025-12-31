# Setup Guide: Cloudflare Email Panel

Panduan ini mencakup instalasi, deployment, dan konfigurasi Cloudflare yang diperlukan agar panel ini berfungsi.

## Prasyarat
1.  **Node.js**: Pastikan Node.js (v16 atau lebih baru) sudah terinstall.
2.  **Akun Cloudflare**: Anda memerlukan akun aktif dengan domain yang sudah terhubung.

## Cara Otomatis (Rekomendasi)
Gunakan script AIO (All-In-One) yang sudah disediakan untuk mengotomatiskan instalasi dan konfigurasi.

1.  Buka terminal di folder proyek.
2.  Jalankan perintah setup:
    ```bash
    npm run setup
    ```
3.  Ikuti petunjuk interaktif di layar:
    *   Script akan menginstall paket NPM.
    *   Meminta **API Token**, **Account ID**, dan **Zone ID** Cloudflare Anda.
    *   Meminta login ke Wrangler (Cloudflare CLI).
    *   Membuat database D1 untuk Inbox.
    *   Men-deploy Worker ke Cloudflare.

## Konfigurasi Manual (Jika Cara Otomatis Gagal)

### 1. Environment Variables
Buat file `.env` di root folder dan isi dengan data berikut:
```env
CF_API_TOKEN=token_api_anda
CF_ACCOUNT_ID=account_id_anda
CF_ZONE_ID=zone_id_anda
CF_D1_DATABASE_ID=uuid_database_d1_anda
PORT=3000
```

### 2. Mendapatkan API Token
1.  Buka Cloudflare Profile > API Tokens.
2.  Klik **Create Token**.
3.  Pilih template **Edit Zone DNS** atau buat Custom Token dengan izin:
    *   **Zone > Email Routing Rules**: Edit
    *   **Account > D1**: Edit
    *   **Zone > Zone**: Read

### 3. Deploy Worker & Database
1.  Masuk ke folder worker: `cd worker`
2.  Install dependensi: `npm install`
3.  Login Cloudflare: `npx wrangler login`
4.  Buat database: `npx wrangler d1 create email-db`
5.  Salin `database_id` yang muncul ke file `wrangler.toml` dan `.env`.
6.  Deploy worker: `npx wrangler deploy`

## Langkah Terakhir: Konfigurasi di Cloudflare (Wajib)

1.  **Aktifkan Email Routing**:
    *   Buka Dashboard Cloudflare > Pilih Domain > **Email** > **Email Routing**.
    *   Klik **Get Started** dan tambahkan DNS record yang diminta (MX dan TXT).
    *   Pastikan statusnya **Enabled**.

2.  **Hubungkan Worker**:
    *   Setelah panel berjalan (lihat `README_RUN.md`), buka Dashboard Panel.
    *   Klik **Add Rule**.
    *   Pilih **Rule Type**: `Send to Worker`.
    *   Isi **Worker Name**: `inbox-worker` (atau nama worker yang Anda deploy).
    *   Simpan rule tersebut.