-- ─────────────────────────────────────────────────────────────────────────────
-- Allowed Users — Admin management policy
--
-- Users with label = 'Owner' in allowed_users can read and manage all rows.
-- Regular users can still only read their own row (existing policy).
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Admin can manage all allowed users"
  on public.allowed_users
  for all
  using (
    exists (
      select 1 from public.allowed_users au
      where au.email = auth.jwt() ->> 'email'
        and au.label = 'Owner'
    )
  )
  with check (
    exists (
      select 1 from public.allowed_users au
      where au.email = auth.jwt() ->> 'email'
        and au.label = 'Owner'
    )
  );
