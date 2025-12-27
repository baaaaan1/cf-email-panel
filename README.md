# Cloudflare Email Panel ✉️

![license](https://img.shields.io/badge/license-ISC-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![express](https://img.shields.io/badge/express-5.x-informational.svg)
![status](https://img.shields.io/badge/state-SpA%20%2B%20API-success.svg)

Panel ringan untuk mengelola Cloudflare Email Routing — membuat, menampilkan, meng‑update, menghapus rules & destinations (destinations CRUD sederhana via API). Kini menggunakan arsitektur terpisah (HTML + CSS + JS) agar lebih mudah dirawat dan dikembangkan.

> Tip: gunakan token Cloudflare dengan hak minimum (least privilege). Jangan commit `.env` ke repo publik.

---

## ✨ Fitur Utama

- Tema Gelap/Terang (persist dengan `localStorage`)
- CRUD Rules (Create / Update status enable / Delete) via endpoint `/api/rules`
- Statistik jumlah total & active rules (otomatis update)
- Panel Status API (cek `/health` + badge dinamis)
- Modal form interaktif (tanpa inline handler; semua event di `main.js`)
- Notifikasi ringan (custom toast div)
- Desain responsif (mobile < 768px menyesuaikan layout)

Screenshot (tambahkan sendiri jika perlu):
```
docs/img/panel-example.png (placeholder)
```

---

## 🏗 Arsitektur Frontend

Folder `public/`:

| File | Fungsi |
|------|--------|
| `index.html` | Shell SPA: markup utama, hanya referensi ke CSS & JS eksternal |
| `styles.css` | Seluruh styling (variabel CSS, layout, komponen, responsif, tema) |
| `main.js` | Logika UI: fetch API, render rules, modal, tema, notifikasi |
| `_sdk/element_sdk.js` | Stub SDK untuk inisialisasi konfigurasi panel (opsional) |
| `_sdk/data_sdk.js` | Stub placeholder untuk helper data (future) |

Semua event sebelumnya (onclick/onsubmit inline) telah diganti dengan `addEventListener` di `main.js` (delegasi untuk action button rules menggunakan `data-action`).

---

## 🚀 Quickstart

1. Clone repo dan masuk ke folder:
	```powershell
	git clone <your-repo-url>
	Set-Location .\cf-email-panel
	```
2. Salin `.env.example` ke `.env` dan isi variabel:
	```powershell
	copy .env.example .env
	# edit .env untuk menambahkan token & IDs Cloudflare
	```
3. Install dependency:
	```powershell
	npm install
	```
4. Jalankan (mode dev auto-reload dengan nodemon):
	```powershell
	npm run dev
	```
	Production sederhana:
	```powershell
	npm start
	```
5. Buka http://localhost:3000 ✅

---

## 🔐 Mendapatkan API Token & IDs Cloudflare

1. Login https://dash.cloudflare.com
2. Account ID: buka halaman Account → salin `Account ID`
3. Zone ID: buka halaman domain (zone) → salin `Zone ID`
4. API Token: Profile → My Profile → API Tokens → Create Token (beri permission minimal: Email Routing Read/Write sesuai kebutuhan)
5. Simpan token ke `.env`: `CF_API_TOKEN`

Contoh `.env`:
```env
PORT=3000
CF_API_TOKEN=cf_...       # API token Cloudflare
CF_ACCOUNT_ID=...         # Account ID
CF_ZONE_ID=...            # Zone ID
```

Jika variabel penting tidak ada, server akan berhenti dengan pesan fatal.

---

## � Struktur Backend / Server

- `server.js` Express 5: menyajikan static files + endpoint JSON (`/api/destinations`, `/api/rules`, `/api/catch-all`, `/health`).
- Middleware logger sederhana mencetak setiap request (diagnosa cepat 404 / routing).
- Fallback SPA menggunakan regex agar tidak mengganggu `/api/*` dan `/health` di Express 5.

---

## ✅ Health Check & Uji Cepat

Setelah server jalan:
```powershell
curl http://localhost:3000/health
```
Response menampilkan metrik rules & destinations.

---

## 🛡️ Keamanan Saat Publish

- Pastikan `.env` di-ignore (`.gitignore` sudah mencantumkan).
- Jika `.env` sempat ter-commit: hapus dari index dan commit ulang:
  ```powershell
  git rm --cached .env
  git commit -m "Remove .env"
  git push
  ```
- Rotate token segera jika pernah terekspos.
- Gunakan BFG Repo Cleaner untuk membersihkan history jika perlu.

---

## 🛠 Deploy Production Singkat

Tidak butuh build / bundler. Jalankan dengan process manager (contoh PM2):
```powershell
npm install -g pm2
pm2 start server.js --name cf-email-panel --env production
```

Atau gunakan Docker (contoh minimal — belum disertakan Dockerfile resmi):
```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 🧪 Pengembangan Lanjut / Ide Next Step

- Menambah validasi form (regex email lebih ketat)
- Dukungan aksi rule `drop` & `worker` (saat ini UI hanya forward)
- Paging / filter rules kalau jumlah besar
- Screenshot & dokumentasi visual
- Test otomatis (Jest) untuk helper Cloudflare API

---
npm
## 📣 Contributing

PR & issues dipersilakan — jangan sertakan secrets. Ikuti prinsip least privilege.

---

## 📄 License

ISC

---

Terima kasih sudah menggunakan / berkontribusi! ⭐


