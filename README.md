# OrienteerPro - Next Generation Orienteering Platform

**Fullständig orienteringsplattform** som kombinerar MeOS, Livelox och Strava-funktionalitet i en modern, offline-first PWA.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)

---

## ✨ Features

### 🔐 Autentisering
- Google OAuth & Email/Password
- 7-dagars persistent sessions (offline-kompatibel)
- Rollbaserad access (Admin/Arrangör/Löpare)
- Session management med aktivitetsövervakning

### 📅 Tävlingshantering (MeOS-liknande)
- Eventor API-integration
- Events-browser med filter
- Event details med tabs (Info/Klasser/Resultat)
- Admin-panel för tävlingsadministration
- **Klubb-specifika Eventor API-nycklar**

### 📍 GPS & Tracking (Livelox-liknande)
- Real-time GPS-tracking
- Live recording med statistik
- GPX-export till Strava/Garmin
- Tracks-lista med analys
- Live tracking-karta
- Offline-lagring i IndexedDB

### 🗺️ Kartor & Banor
- MapLibre GL JS integration
- OMAP (.omap/.xmap) parser med georeferens
- Koordinattransformation (WGS84 ↔ SWEREF99 TM)
- Kartimport-UI med drag-and-drop
- Kurs-rendering (kontroller, start, mål)

### 💳 SportIdent-integration
- Web Serial API (Chrome/Edge)
- Fullt SI-protokoll med CRC-validering
- Bricktyp-detection (SI5-11, SIAC)
- Real-time kortavläsning
- Stämplingshistorik

### 🏆 Resultathantering
- SI card → Result konvertering
- Sträcktidsanalys
- Validering (missing/extra controls)
- Ranking & placering
- Time behind leader

### 💾 Offline-First
- IndexedDB med Dexie.js
- Sync Manager med konflikthantering
- Transaction log
- Background sync
- Service Worker för asset-caching

### 📱 PWA
- Installbar app
- Service Worker
- Offline-sida
- Push notifications (foundation)
- Responsive design med dark mode

---

## 🏗️ Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- MapLibre GL JS

**Backend:**
- Firebase Auth
- Firestore
- Cloud Storage
- IndexedDB (Dexie.js)

**APIs:**
- Eventor REST API
- Web Serial API
- Geolocation API

**Key Libraries:**
- `proj4` - Koordinattransformation
- `xml2js` - IOF XML parsing
- `dexie` - IndexedDB wrapper

---

## 🚀 Getting Started

### Prerequisites

```bash
Node.js 18+
npm or yarn
```

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/orienteerpro.git
cd orienteerpro

# Install dependencies
npm install

# Create environment file
cp env.example.txt .env.local

# Edit .env.local with your Firebase credentials
```

### Development

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Production build
npm run build
├── components/           # React components
│   ├── Map/             # Kartkomponenter
│   ├── Tracking/        # Live tracking
│   ├── Events/          # Tävlingar
│   ├── Results/         # Resultat
│   └── Admin/           # Administration
├── lib/                 # Core libraries
│   ├── db/              # IndexedDB (Dexie)
│   ├── iof/             # IOF XML parser
│   ├── eventor/         # Eventor API client
│   ├── maps/            # Kartmotor
│   ├── gps/             # GPS tracking
│   ├── sportident/      # SportIdent protocol
│   ├── geo/             # Koordinattransform
│   └── sync/            # Offline sync
└── types/               # TypeScript types
```

## Standards & APIs

- **IOF Data Standard 3.0**: XML format för tävlingsdata
- **Eventor API**: Svenska Orienteringsförbundets system
- **OCAD/OOM**: Orienteringskartformat
- **SportIdent**: Tidtagningshårdvara
