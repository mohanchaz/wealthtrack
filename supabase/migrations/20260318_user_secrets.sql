-- ─────────────────────────────────────────────────────────────────────────────
-- User Secrets — encrypted key storage
-- Stores AES-GCM encrypted blobs client-side encrypted before upload.
-- The server never sees plaintext values.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_secrets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  secrets    jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table public.user_secrets enable row level security;

create policy "Users manage own secrets"
  on public.user_secrets
  for all
  using  ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );
