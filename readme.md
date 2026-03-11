# WealthTrack v2 —m Module 1

Modern React + TypeScript rewrite. Cloudflare Pages compatible.

## Stack
- **React 18 + TypeScript**
- **Vite 6** (build tool, HMR)
- **Tailwind CSS 3** — light teal/green design system
- **Plus Jakarta Sans** + **JetBrains Mono** (financial numbers)
- **Supabase JS v2** — typed client
- **TanStack Query v5** — server state & caching
- **Zustand** — client state (auth, UI, toasts)
- **Recharts** — allocation donut
- **React Router v6** — SPA routing with auth guard

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your Supabase credentials:
#   VITE_SUPABASE_URL=https://...
#   VITE_SUPABASE_ANON_KEY=...

# 3. Start dev server
npm run dev
# → http://localhost:5173
```

## Build & Deploy

```bash
# Type check
npm run typecheck

# Production build (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

### Cloudflare Pages Settings
| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 20 |
| Environment variable | `VITE_SUPABASE_URL` |
| Environment variable | `VITE_SUPABASE_ANON_KEY` |

The `functions/api/prices.js` Cloudflare Pages Function is detected automatically.

## Project Structure

```
src/
├── lib/            supabase.ts · utils.ts · queryClient.ts
├── store/          authStore · toastStore · uiStore
├── types/          index.ts · assets.ts
├── services/       allocationService · dashboardService · priceService
│                   assetService · actualInvestedService
├── hooks/          useAllocations · useDashboardStats · useAssets · useActualInvested
├── constants/      chartColors · navItems
├── components/
│   ├── ui/         Button · Input · Modal · Spinner · StatCard · Toast
│   ├── layout/     AppShell · Sidebar · Topbar
│   ├── charts/     AllocationDonut
│   └── common/     AssetTable · SummaryCard · ActualInvestedPanel
└── features/
    ├── auth/       LoginPage
    ├── dashboard/  DashboardPage
    ├── allocation/ AllocationPage · EditAllocationModal
    └── assets/     AssetsPage (stub — Module 2)

functions/
└── api/prices.js   ← Cloudflare Pages Function (unchanged)
```

## Module 1 Coverage
- ✅ Google OAuth + Email/Password sign-in
- ✅ Protected routing with `PrivateRoute`
- ✅ Dashboard: live net worth from all 12 asset tables + P&L
- ✅ Ideal Allocation: donut chart + bar list + full CRUD + seed defaults
- ✅ Responsive sidebar with nested nav (Zerodha / Aionion / Foreign groups)
- ✅ Toast notification system
- ✅ Light teal+green design system (Plus Jakarta Sans + JetBrains Mono)

## Module 2 (next)
- 12 asset panel pages with full holdings tables
- Live NSE/BSE/Crypto price refresh
- CSV import modals
- Per-row edit modals
- Actual-invested ledger per asset class
