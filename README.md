# Cloudflare Email Panel ✉️

![license](https://img.shields.io/badge/license-ISC-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![express](https://img.shields.io/badge/express-5.x-informational.svg)
![status](https://img.shields.io/badge/state-stable-success.svg)

A lightweight, modern web panel to manage **Cloudflare Email Routing** settings. Create, view, update, and delete routing rules and destinations through a clean, responsive interface.

Built with **Node.js (Express)** backend and **Vanilla JS/CSS** frontend.

> **Note:** This application is designed to be self-hosted. Ensure you protect access to this panel (e.g., via Cloudflare Access, VPN, or private network) as it provides control over your email routing.

---

## ✨ Features

- **Dashboard Overview**: View total and active rules statistics.
- **Rule Management**: Create, edit, delete, and toggle email forwarding rules.
- **Theme Support**: Built-in Dark Mode and Light Mode (persisted).
- **API Status**: Real-time connection status check with Cloudflare API.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Zero Build Step**: Pure HTML/CSS/JS frontend served by Express. No Webpack/Vite required.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Cloudflare account with an active Zone and Email Routing enabled.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cf-email-panel.git
   cd cf-email-panel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your Cloudflare credentials:
   ```env
   PORT=3000
   CF_API_TOKEN=your_api_token_here
   CF_ACCOUNT_ID=your_account_id_here
   CF_ZONE_ID=your_zone_id_here
   ```

   > **Tip:** Create an API Token with **Email Routing: Edit** permissions.

4. **Run the application**
   
   Development (auto-reload):
   ```bash
   npm run dev
   ```
   
   Production:
   ```bash
   npm start
   ```

5. **Access the panel**
   Open `http://localhost:3000` in your browser.

---

## 🔐 Getting Cloudflare Credentials

1. Log in to Cloudflare Dashboard.
2. **Account ID**: Go to your Account page (or any domain overview) → Copy `Account ID` from the sidebar.
3. **Zone ID**: Go to the specific domain (zone) you want to manage → Copy `Zone ID` from the sidebar.
4. **API Token**: 
   - Go to **My Profile** → **API Tokens** → **Create Token**.
   - Use the "Create Custom Token" template.
   - Permissions: `Zone` > `Email Routing Rules` > `Edit`.
   - Zone Resources: `Include` > `Specific zone` > `Your Domain`.

---

## 🛠 Deployment

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start server.js --name cf-email-panel --env production
```

### Using Docker

A simple `Dockerfile` is included (or create one):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t cf-email-panel .
docker run -d -p 3000:3000 --env-file .env cf-email-panel
```

---

## 🛡️ Security Note

- **Never commit your `.env` file.** The `.gitignore` file is set up to exclude it, but double-check before pushing.
- Since this panel allows modifying email routing, **do not expose it to the public internet** without authentication (like Cloudflare Access or Basic Auth).

---

## 🏗 Project Structure

- `server.js`: Express server handling API proxying to Cloudflare.
- `public/`: Static frontend files.
  - `index.html`: Single Page Application shell.
  - `main.js`: UI logic, API calls, and state management.
  - `styles.css`: Custom CSS variables and responsive styles.

---

## 📄 License

ISC License.
