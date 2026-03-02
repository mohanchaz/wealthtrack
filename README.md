# FinTrack — Setup Guide

## Step 1 — Run the Database Schema in Supabase
1. Go to your Supabase project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase-schema.sql` from this project
5. Copy all the SQL → Paste into the editor → Click **Run**
6. You should see "Success" ✅

## Step 2 — Set Up Environment Variables
1. Copy `.env.local.example` → rename to `.env.local`
2. Fill in your values:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
   - `ALLOWED_EMAILS` = comma-separated list of allowed Gmail accounts

## Step 3 — Push to GitHub
Open VS Code terminal:
```bash
git add .
git commit -m "Module 1: Project setup"
git push
```

## Step 4 — Connect Cloudflare Pages
1. Go to Cloudflare Dashboard → Workers & Pages → Create → Pages
2. Connect GitHub → select your `fintrack` repo
3. Set build settings:
   - **Framework:** Next.js
   - **Build command:** `npx @cloudflare/next-on-pages`
   - **Output directory:** `.vercel/output/static`
   - **Node version:** `20` (set in Environment Variables as `NODE_VERSION = 20`)

## Step 5 — Add Environment Variables in Cloudflare
In Cloudflare Pages → your project → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL     = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
SUPABASE_SERVICE_ROLE_KEY    = eyJ...
ALLOWED_EMAILS               = you@gmail.com,other@gmail.com
```

## Step 6 — Add Callback URL in Supabase
In Supabase → Authentication → URL Configuration → add:
```
https://your-project.pages.dev/auth/callback
```

## Step 7 — Deploy
Cloudflare Pages will auto-deploy on every `git push`.
Your app will be live at: `https://fintrack.pages.dev` (or your custom domain)

---

## Project Structure
```
src/
  app/
    login/          → Google Sign-in page
    auth/callback/  → OAuth callback handler
    dashboard/      → Module 2 (coming next)
    assets/         → Module 3
    liabilities/    → Module 4
    transactions/   → Module 5
    goals/          → Module 6
    snapshots/      → Module 7
  lib/
    supabase/
      client.ts     → Browser Supabase client
      server.ts     → Server Supabase client
    utils.ts        → Helpers & constants
  middleware.ts     → Auth protection + email whitelist
  types/index.ts    → TypeScript types
supabase-schema.sql → Run in Supabase SQL Editor
```
