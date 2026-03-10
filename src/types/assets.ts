// ── Generic stock row (zerodha_stocks, aionion_stocks) ────────
export interface StockHolding {
  id:          string
  user_id:     string
  instrument:  string
  qty:         number
  prev_qty?:   number
  avg_cost:    number
  created_at?: string
  imported_at?: string
}

// ── MF holding (mf_holdings) ──────────────────────────────────
export interface MfHolding {
  id:            string
  user_id:       string
  fund_name:     string
  qty:           number
  avg_cost:      number
  nav_symbol?:   string | null  // BSE symbol for live NAV e.g. "0P0000XW75.BO"
  prev_qty?:     number
  imported_at?:  string
}

// ── Gold holding (gold_holdings) ─────────────────────────────
export interface GoldHolding {
  id:            string
  user_id:       string
  holding_name?:  string
  holding_type?:  'ETF' | 'MF' | string
  qty:           number
  prev_qty?:     number
  avg_cost:      number
  yahoo_symbol?: string
  invested?:     number
  current_value?: number
  created_at?:   string
}

// ── Aionion Gold (aionion_gold) ───────────────────────────────
export interface AionionGoldHolding {
  id:            string
  user_id:       string
  instrument:    string
  qty:           number
  prev_qty?:     number
  avg_cost:      number
  yahoo_symbol?: string
  invested?:     number
  current_value?: number
  created_at?:   string
}

// ── AMC MF holding (amc_mf_holdings) ─────────────────────────
export interface AmcMfHolding {
  id:            string
  user_id:       string
  platform?:     string       // used as fund name / AMC name
  qty:           number
  prev_qty?:     number
  avg_cost:      number
  nav_symbol?:   string
  folio_number?: string
  created_at?:   string
}

// ── Foreign stock holding (foreign_stock_holdings) ────────────
export interface ForeignHolding {
  id:            string
  user_id:       string
  symbol:        string
  qty:           number
  prev_qty?:     number
  avg_price:     number
  currency:      'USD' | 'GBP' | 'GBX' | string
  created_at?:   string
}

// ── Crypto holding (crypto_holdings) ─────────────────────────
export interface CryptoHolding {
  id:              string
  user_id:         string
  yahoo_symbol:    string
  platform:        string
  qty:             number
  prev_qty?:       number
  avg_price_gbp:   number
  updated_at?:     string
}

// ── Bank FD (bank_fd_assets) ──────────────────────────────────
export interface FdAsset {
  id:                 string
  user_id:            string
  category:           string
  platform?:          string
  account_number?:    string
  sb_account_number?: string
  invested:           number
  invested_date?:     string
  interest_rate?:     number
  maturity_date?:     string
  maturity_amount?:   number
  notes?:             string
  created_at?:        string
}

// ── Emergency Fund (emergency_funds) ─────────────────────────
export interface EfAsset {
  id:                 string
  user_id:            string
  category?:          string
  platform?:          string
  account_number?:    string
  sb_account_number?: string
  invested:           number
  invested_date?:     string
  interest_rate?:     number
  maturity_date?:     string
  maturity_amount?:   number
  notes?:             string
  created_at?:        string
  updated_at?:        string
}

// ── Cash asset (cash_assets) ──────────────────────────────────
export interface CashAsset {
  id:                 string
  user_id:            string
  category:           string
  platform?:          string
  account_number?:    string
  sb_account_number?: string
  invested:           number
  current_value?:     number
  notes?:             string
  created_at?:        string
}

// ── Bond asset (bonds) ────────────────────────────────────────
export interface BondAsset {
  id:                 string
  user_id:            string
  name:               string
  platform?:          string
  isin?:              string
  bond_id?:           string
  sb_account_number?: string
  invested:           number
  face_value?:        number
  interest_rate?:     number
  purchase_date?:     string
  maturity_date?:     string
  created_at?:        string
}

// ── Actual invested entry ──────────────────────────────────────
export interface ActualEntry {
  id:         string
  user_id:    string
  amount:     number
  note?:      string
  created_at?: string
}
