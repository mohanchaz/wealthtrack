-- Run in Supabase → SQL Editor → New Query
create extension if not exists "uuid-ossp";

create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null, class text not null,
  value numeric not null default 0, currency text not null default 'INR',
  quantity numeric, notes text, updated_at timestamptz not null default now()
);
alter table assets enable row level security;
create policy "own assets" on assets for all using (auth.uid() = user_id);

create table if not exists liabilities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null, type text not null,
  outstanding numeric not null default 0, emi numeric, interest numeric,
  notes text, updated_at timestamptz not null default now()
);
alter table liabilities enable row level security;
create policy "own liabilities" on liabilities for all using (auth.uid() = user_id);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income','expense')),
  category text not null, amount numeric not null, note text,
  date date not null default current_date
);
alter table transactions enable row level security;
create policy "own transactions" on transactions for all using (auth.uid() = user_id);

create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null, target numeric not null, current numeric not null default 0,
  currency text not null default 'INR', deadline date, notes text,
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "own goals" on goals for all using (auth.uid() = user_id);

create table if not exists snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  net_worth numeric not null, total_assets numeric not null,
  total_liabilities numeric not null, breakdown jsonb not null default '{}',
  taken_at timestamptz not null default now()
);
alter table snapshots enable row level security;
create policy "own snapshots" on snapshots for all using (auth.uid() = user_id);
