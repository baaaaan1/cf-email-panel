# Running the Cloudflare Email Panel

Panduan cara menjalankan aplikasi dan menggunakan fiturnya.

## Menjalankan Server

1.  Buka terminal di root folder proyek.
2.  Jalankan perintah start:
    ```bash
    npm start
    ```
    *   *Atau untuk mode development:* `npm run dev`

3.  Buka browser dan akses: `http://localhost:3000`

## Menggunakan Panel

### Dashboard
*   **Stats**: Melihat jumlah total rule dan rule yang aktif.
*   **API Status**: Mengecek koneksi ke API Cloudflare.
*   **Manage Rules**:
    *   **Add Rule**: Membuat alias email baru (Forward, Drop, atau Worker).
    *   **Toggle**: Mengaktifkan/menonaktifkan rule dengan cepat.
    *   **Delete**: Menghapus rule permanen.

### Inbox (Kotak Masuk)
*   Klik tab **Inbox** untuk melihat email yang masuk ke Worker.
*   **Initialize Database**: Jika muncul error "Table not found", klik tombol **Initialize Database** yang muncul di layar untuk membuat tabel secara otomatis.
*   **Baca Email**: Klik pada email untuk membaca isi pesan (mendukung HTML dan Text).

### Settings
*   Klik tombol **Settings** (ikon gerigi) untuk mengubah API Token atau D1 Database ID tanpa perlu mengedit file `.env` secara manual.

## Troubleshooting

*   **Error "Cannot GET /api/inbox"**:
    *   Server belum mengenali endpoint baru. Matikan server (`Ctrl+C`) lalu jalankan lagi (`npm start`).

*   **Error "Invalid UUID"**:
    *   `CF_D1_DATABASE_ID` di file `.env` salah atau masih kosong. Jalankan `npm run setup` lagi atau cek panduan Setup.

*   **Email tidak masuk ke Inbox**:
    1.  Pastikan **Email Routing** sudah **Enabled** di dashboard Cloudflare.
    2.  Pastikan Anda sudah membuat Rule di panel yang mengarah ke `inbox-worker`.
    3.  Cek log worker di Cloudflare Dashboard > Workers > inbox-worker > Logs.