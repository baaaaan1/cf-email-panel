# Cloudflare Email Panel ✉️

![license](https://img.shields.io/badge/license-ISC-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![npm](https://img.shields.io/badge/npm-available-orange.svg)

A lightweight panel to manage Cloudflare Email Routing — list/create/delete destinations and rules. Ideal when you want a simple UI to manage Cloudflare email routing.

Tip: use the minimum‑privilege Cloudflare API token. Never commit your `.env` to a public repo.

---

## 🚀 Quickstart (Windows PowerShell)

1) Clone the repo and enter the folder:

```powershell
git clone <your-repo-url>
Set-Location .\cf-email-panel
```

2) Create your environment file from the example and fill in values:

```powershell
copy .env.example .env
# then edit .env with your editor (set token and IDs)
```

3) Install dependencies:

```powershell
npm install
```

4) Run in dev mode (auto‑reload) or start normally:

```powershell
npm run dev
# or
npm start
```

Open http://localhost:3000 ✅

---

## 🔐 Cloudflare token and IDs

How to obtain the required values:

1) Log in to https://dash.cloudflare.com
2) Account ID: go to the Account page → copy the Account ID
3) Zone ID: go to your domain (zone) page → copy the Zone ID
4) API Token: Profile → My Profile → API Tokens → Create Token
	- Use the least permissions you need. For managing rules, include Email Routing:Edit on the relevant scope.

Copy the token once it’s generated and put it in `.env` as `CF_API_TOKEN`.

---

## 🧩 Project structure (key files)

- `server.js` — Express app and JSON API
- `.env.example` — sample environment configuration
- `public/` — static front‑end (index.html and assets)
- `start.ps1`, `start.bat` — Windows helper launchers
- `README.md` — this document

---

## 🔧 Configuration (.env)

Copy `.env.example` to `.env` and set your values.

```dotenv
PORT=3000
CF_API_TOKEN=cf_...       # Cloudflare API token
CF_ACCOUNT_ID=...         # Your Account ID
CF_ZONE_ID=...            # Your Zone ID
```

---

## ▶️ Run and test

Start the server then check health:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/health
```

Open the app in your browser: http://localhost:3000

---

## 🔒 Security and publishing to GitHub

- Ensure `.gitignore` contains `.env` and don’t commit secrets.
- If `.env` was ever committed, remove it from the index and push:

```bash
git rm --cached .env
git commit -m "Remove .env"
git push
```

- If a token was exposed, rotate/revoke it in Cloudflare immediately.
- To scrub history, use BFG Repo Cleaner or `git filter-branch`.

---

## 🛠️ Production deploy (quick)

This app doesn’t need a build step. Use a process manager like PM2:

```powershell
npm install -g pm2
pm2 start server.js --name cf-email-panel --env production
```

---

## 📣 Contributing

PRs and issues are welcome — please don’t include secrets.

---

## 📄 License

ISC

---

Thanks for using and contributing! ⭐


