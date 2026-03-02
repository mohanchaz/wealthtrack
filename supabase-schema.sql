-- =============================================
-- FinTrack Database Schema
-- Run this in: Supabase → SQL Editor → New Query
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- ASSETS
-- =============================================
create table if not exists assets (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  class        text not null,
  value        numeric not null default 0,
  currency     text not null default 'INR',
  quantity     numeric,
  notes        text,
  updated_at   timestamptz not null default now()
);

alter table assets enable row level security;
create policy "Users can only access their own assets"
  on assets for all using (auth.uid() = user_id);

-- =============================================
-- LIABILITIES
-- =============================================
create table if not exists liabilities (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  type         text not null,
  outstanding  numeric not null default 0,
  emi          numeric,
  interest     numeric,
  notes        text,
  updated_at   timestamptz not null default now()
);

alter table liabilities enable row level security;
create policy "Users can only access their own liabilities"
  on liabilities for all using (auth.uid() = user_id);

-- =============================================
-- TRANSACTIONS (income & expenses)
-- =============================================
create table if not exists transactions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null check (type in ('income', 'expense')),
  category   text not null,
  amount     numeric not null,
  note       text,
  date       date not null default current_date
);

alter table transactions enable row level security;
create policy "Users can only access their own transactions"
  on transactions for all using (auth.uid() = user_id);

create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_transactions_user on transactions(user_id);

-- =============================================
-- GOALS
-- =============================================
create table if not exists goals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  target      numeric not null,
  current     numeric not null default 0,
  currency    text not null default 'INR',
  deadline    date,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table goals enable row level security;
create policy "Users can only access their own goals"
  on goals for all using (auth.uid() = user_id);

-- =============================================
-- SNAPSHOTS
-- =============================================
create table if not exists snapshots (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid references auth.users(id) on delete cascade not null,
  net_worth          numeric not null,
  total_assets       numeric not null,
  total_liabilities  numeric not null,
  breakdown          jsonb not null default '{}',
  taken_at           timestamptz not null default now()
);

alter table snapshots enable row level security;
create policy "Users can only access their own snapshots"
  on snapshots for all using (auth.uid() = user_id);

create index if not exists idx_snapshots_taken_at on snapshots(taken_at);
