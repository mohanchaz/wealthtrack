-- Run this in Supabase SQL editor to enable Analytics / Snapshots

CREATE TABLE IF NOT EXISTS networth_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month            text NOT NULL,           -- 'YYYY-MM', e.g. '2025-03'
  net_worth        numeric NOT NULL,
  invested         numeric NOT NULL,
  actual_invested  numeric NOT NULL DEFAULT 0,
  gain             numeric NOT NULL,        -- net_worth - invested (book)
  gain_pct         numeric NOT NULL,        -- gain / invested * 100
  actual_gain      numeric NOT NULL DEFAULT 0,  -- net_worth - actual_invested
  actual_gain_pct  numeric NOT NULL DEFAULT 0,  -- actual_gain / actual_invested * 100
  note             text,
  created_at       timestamptz DEFAULT now()
);

-- One snapshot per user per month (upsert target)
CREATE UNIQUE INDEX IF NOT EXISTS networth_snapshots_user_month
  ON networth_snapshots (user_id, month);

-- Row Level Security
ALTER TABLE networth_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own snapshots" ON networth_snapshots
  FOR ALL USING (auth.uid() = user_id);
