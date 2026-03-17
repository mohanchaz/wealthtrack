-- ─────────────────────────────────────────────────────────────────────────────
-- Profile Sharing — Read-only access
--
-- If you ran a previous version of this migration, run these ALTER statements
-- to add the new columns to the existing table:
--
--   alter table public.profile_access
--     add column if not exists owner_email text not null default '',
--     add column if not exists owner_name  text not null default '';
--
-- Then revoke and re-grant any existing access so the columns get populated.
-- ─────────────────────────────────────────────────────────────────────────────


create table if not exists public.profile_access (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id) on delete cascade not null,
  owner_email   text not null default '',
  owner_name    text not null default '',
  viewer_email  text not null,
  created_at    timestamptz default now(),
  unique(owner_id, viewer_email)
);

alter table public.profile_access enable row level security;

create policy "Owner can manage access grants"
  on public.profile_access for all
  using  ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );

create policy "Viewer can see their own grants"
  on public.profile_access for select
  using ( viewer_email = auth.jwt() ->> 'email' );

-- ── Shared read policies — one per table ────────────────────────────────────

create policy "Shared viewer read zerodha_stocks"
  on public.zerodha_stocks for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = zerodha_stocks.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read aionion_stocks"
  on public.aionion_stocks for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = aionion_stocks.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read aionion_gold"
  on public.aionion_gold for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = aionion_gold.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read mf_holdings"
  on public.mf_holdings for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = mf_holdings.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read gold_holdings"
  on public.gold_holdings for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = gold_holdings.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read amc_mf_holdings"
  on public.amc_mf_holdings for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = amc_mf_holdings.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read cash_assets"
  on public.cash_assets for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = cash_assets.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read bank_fd_assets"
  on public.bank_fd_assets for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = bank_fd_assets.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read emergency_funds"
  on public.emergency_funds for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = emergency_funds.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read bonds"
  on public.bonds for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = bonds.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read foreign_stock_holdings"
  on public.foreign_stock_holdings for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = foreign_stock_holdings.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read crypto_holdings"
  on public.crypto_holdings for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = crypto_holdings.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read bank_savings"
  on public.bank_savings for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = bank_savings.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read fd_actual_invested"
  on public.fd_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = fd_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read ef_actual_invested"
  on public.ef_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = ef_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read amc_mf_actual_invested"
  on public.amc_mf_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = amc_mf_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read zerodha_actual_invested"
  on public.zerodha_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = zerodha_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read aionion_actual_invested"
  on public.aionion_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = aionion_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read mf_actual_invested"
  on public.mf_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = mf_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read bonds_actual_invested"
  on public.bonds_actual_invested for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = bonds_actual_invested.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read ideal_allocations"
  on public.ideal_allocations for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = ideal_allocations.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read networth_snapshots"
  on public.networth_snapshots for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = networth_snapshots.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

create policy "Shared viewer read goals"
  on public.goals for select
  using ( exists (
    select 1 from public.profile_access
    where owner_id = goals.user_id
      and viewer_email = auth.jwt() ->> 'email'
  ));

