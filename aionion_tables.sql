-- ══════════════════════════════════════════════════════════════
--  Aionion Stocks tables — run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Holdings (no ltp — value is always qty × avg_cost)
CREATE TABLE IF NOT EXISTS aionion_stocks (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users NOT NULL,
  instrument   text NOT NULL,
  qty          numeric NOT NULL DEFAULT 0,
  prev_qty     numeric NOT NULL DEFAULT 0,
  avg_cost     numeric NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, instrument)
);

ALTER TABLE aionion_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON aionion_stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON aionion_stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON aionion_stocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON aionion_stocks FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_aionion_stocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aionion_stocks_updated_at
  BEFORE UPDATE ON aionion_stocks
  FOR EACH ROW EXECUTE FUNCTION update_aionion_stocks_updated_at();


-- 2. Actual Invested entries
CREATE TABLE IF NOT EXISTS aionion_actual_invested (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users NOT NULL,
  entry_date   date NOT NULL,
  amount       numeric NOT NULL CHECK (amount > 0),
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE aionion_actual_invested ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON aionion_actual_invested FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON aionion_actual_invested FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON aionion_actual_invested FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON aionion_actual_invested FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_aionion_actual_invested_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aionion_actual_invested_updated_at
  BEFORE UPDATE ON aionion_actual_invested
  FOR EACH ROW EXECUTE FUNCTION update_aionion_actual_invested_updated_at();