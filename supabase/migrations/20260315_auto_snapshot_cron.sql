-- ─────────────────────────────────────────────────────────────────────────────
-- Auto Monthly Snapshot + Email
--
-- Runs on the 1st of every month at 02:00 UTC (07:30 IST).
-- - Snapshots the CURRENT month (April 1 → saves April)
-- - Sends monthly portfolio report + full CSV backup to each user's email
-- - Never overwrites a manually-saved snapshot
--
-- Prerequisites:
--   1. Enable pg_cron  (Dashboard → Database → Extensions)
--   2. Enable pg_net   (Dashboard → Database → Extensions)
--   3. Deploy function: supabase functions deploy auto-monthly-snapshot
--   4. Set env vars in Supabase Dashboard → Edge Functions → auto-monthly-snapshot:
--        RESEND_API_KEY   = your Resend API key
--        RESEND_FROM      = noreply@yourdomain.com
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule: 02:00 UTC on the 1st of every month
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY before running
select cron.schedule(
  'auto-monthly-snapshot',
  '0 2 1 * *',
  $$
  select net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-monthly-snapshot',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Verify:
-- select jobid, jobname, schedule from cron.job;

-- Unschedule:
-- select cron.unschedule('auto-monthly-snapshot');

-- Test immediately (fires the function right now):
-- select net.http_post(
--   url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-monthly-snapshot',
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--   body    := '{}'::jsonb
-- );
