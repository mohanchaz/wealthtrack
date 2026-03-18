-- ─────────────────────────────────────────────────────────────────────────────
-- Allowed Users — Admin management policy
--
-- Uses a security definer function to avoid infinite recursion when the
-- policy checks the same table it's guarding.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Create a security definer function that checks owner status.
-- SECURITY DEFINER bypasses RLS so there's no recursive policy check.
create or replace function public.is_allowed_users_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where email = auth.jwt() ->> 'email'
      and label = 'Owner'
  );
$$;

-- Step 2: Drop the old recursive policy if it exists
drop policy if exists "Admin can manage all allowed users" on public.allowed_users;

-- Step 3: Create the admin policy using the function — no recursion
create policy "Admin can manage all allowed users"
  on public.allowed_users
  for all
  using  ( public.is_allowed_users_owner() )
  with check ( public.is_allowed_users_owner() );
