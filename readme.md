# WealthTrack v2 — Module 1: Auth + Dashboard + Allocation

Modern React + TypeScript rewrite of WealthTrack. Cloudflare Pages compatible.

## Stack
- **React 18** + TypeScript
- **Vite 6** (build tool)
- **Tailwind CSS 3** (design system)
- **Supabase JS v2** (typed client)
- **TanStack Query v5** (server state)
- **Zustand** (client state)
- **Recharts** (charts)
- **React Router v6** (routing)

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Dev server
npm run dev
# Open http://localhost:5173
```

## Environment Variables
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Build & Deploy (Cloudflare Pages)
```bash
npm run build   # outputs to dist/
```

Cloudflare Pages settings:
- **Build command:** `npm run build`
- **Build output dir:** `dist`
- **Node version:** 20

The `/functions/api/prices.js` Cloudflare Pages Function is picked up automatically.

## Module 1 — What's included
- ✅ Full auth (Google OAuth + email/password)
- ✅ Protected routing with React Router v6
- ✅ Dashboard with live net worth stats (all 12 asset tables)
- ✅ Ideal Allocation page — donut chart + bar list + full CRUD
- ✅ Responsive sidebar navigation with nested groups
- ✅ Toast notification system
- ✅ Dark theme design system

## Module 2 — Coming next
- Asset panels for all 12 asset classes
- Live price refresh (NSE/BSE/Crypto)
- CSV import modals
- Per-row edit modals
- Actual-invested ledger
