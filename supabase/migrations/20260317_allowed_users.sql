-- ─────────────────────────────────────────────────────────────────────────────
-- Allowlist Access Control
--
-- Only users whose email appears in `allowed_users` can log in.
-- You manage this table directly via the Supabase Dashboard (Table Editor).
--
-- To add a user:
--   insert into public.allowed_users (email) values ('friend@example.com');
--
-- To remove a user:
--   delete from public.allowed_users where email = 'friend@example.com';
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.allowed_users (
  email      text primary key,
  label      text,                          -- optional: human-readable name/note
  added_at   timestamptz default now()
);

-- Enable Row Level Security
alter table public.allowed_users enable row level security;

-- A signed-in user can only check their own row — nothing else is readable
create policy "User can check own allowlist status"
  on public.allowed_users
  for select
  using ( auth.jwt() ->> 'email' = email );

-- ── Seed: add YOUR email here before running ──────────────────────────────────
-- Replace the address below with the email you use to sign in.
insert into public.allowed_users (email, label)
values ('mohanchaz1095@gmail.com', 'Owner')
on conflict (email) do nothing;

insert into public.allowed_users (email, label)
values ('mohanchaz@gmail.com', 'Owner')
on conflict (email) do nothing;