 # Cloudflare Email Panel ✉️

 ![license](https://img.shields.io/badge/license-ISC-blue.svg)
 ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
 ![npm](https://img.shields.io/badge/npm-available-orange.svg)

 Panel ringan untuk mengelola Cloudflare Email Routing — membuat/menampilkan/menghapus destinations dan rules. Cocok untuk admin yang ingin UI kecil untuk mengelola email routing Cloudflare.

 > Tip: gunakan token Cloudflare dengan hak minimum (least privilege). Jangan commit `.env` ke repo publik.

 ---

 ## 🚀 Cepat (Quickstart)

 1. Clone repo dan masuk ke folder:

 ```powershell
 git clone <your-repo-url>
 Set-Location .\cf-email-panel
 ```

 2. Salin `.env.example` ke `.env` dan lengkapi variabel:

 ```powershell
 copy .env.example .env
 # lalu edit .env dengan editor favorit Anda
 ```

 3. Install dependency:

 ```powershell
 npm install
 ```

 4. Jalankan (dev - auto reload):

 ```powershell
 npm run dev
 ```

 atau jalankan production:

 ```powershell
 npm start
 ```

 Buka http://localhost:3000 ✅

 ---

 ## 🔐 Mengambil API Token & IDs (Cloudflare)

 Ikuti langkah ini untuk mendapatkan token dan IDs yang diperlukan:

 1. Masuk ke https://dash.cloudflare.com
 2. Account ID: buka halaman Account → salin `Account ID`
 3. Zone ID: buka halaman domain (zone) → salin `Zone ID`
 4. API Token: Profile → My Profile → API Tokens → Create Token. Pilih permissions minimal (Account:Read / Email Routing:Edit ketika perlu).

 Salin token sekali saat dibuat dan simpan di `.env` sebagai `CF_API_TOKEN`.

 ---

 ## 🧩 Struktur & file penting

 - `server.js` — aplikasinya (Express)
 - `.env.example` — contoh konfigurasi environment
 - `start.ps1`, `start.bat` — helper untuk Windows
 - `README.md` — dokumentasi ini

 ---

 ## 🔧 Konfigurasi (.env)

 Contoh `.env` (isi `.env` Anda, jangan commit file ini):

 ```text
 PORT=3000
 CF_API_TOKEN=cf_...       # API token Cloudflare
 CF_ACCOUNT_ID=...         # Account ID
 CF_ZONE_ID=...            # Zone ID
 ```

 ---

 ## 🛡️ Keamanan & Publish ke GitHub

 Sebelum mem-push public:

 - Pastikan `.gitignore` berisi `.env`.
 - Jika `.env` pernah ter-commit, hapus dari index dan commit:

 ```bash
 git rm --cached .env
 git commit -m "Remove .env"
 git push
 ```

 - Jika token ter-expose, segera rotate/revoke di Cloudflare.
 - Untuk membersihkan history: gunakan BFG Repo Cleaner (direkomendasikan) atau `git filter-branch`.

 ---

 ## ✅ Health check & testing

 Setelah server berjalan, cek:

 ```powershell
 curl http://localhost:3000/health
 ```

 Buka root di browser: http://localhost:3000

 ---

 ## 🛠️ Deploy production (singkat)

 Aplikasi ini tidak perlu build. Untuk production gunakan process manager seperti PM2:

 ```powershell
 npm install -g pm2
 pm2 start server.js --name cf-email-panel --env production
 ```

 ---

 ## 📣 Contributing

 PR dan issues welcome — jangan sertakan secrets.

 ---

 ## 📄 License

 ISC

 ---

 Terima kasih sudah menggunakan/menyumbang! ⭐


