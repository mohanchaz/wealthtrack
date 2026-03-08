// ─── Shared ─────────────────────────────────────────────────
export interface BaseRow {
  id: string
  user_id: string
  created_at?: string
  updated_at?: string
}

export interface ActualInvestedRow extends BaseRow {
  entry_date: string
  amount: number
  notes?: string | null
}

// ─── Asset class rows ────────────────────────────────────────
export interface CashAsset extends BaseRow {
  category: string
  platform?: string | null
  account_number?: string | null
  sb_account_number?: string | null
  invested: number
  current_value: number
}

export interface FdAsset extends BaseRow {
  category: string
  platform?: string | null
  account_number?: string | null
  sb_account_number?: string | null
  invested: number
  invested_date?: string | null
  interest_rate?: number | null
  maturity_date?: string | null
  maturity_amount?: number | null
}

export interface EmergencyFund extends FdAsset {}

export interface Bond extends BaseRow {
  name: string
  platform?: string | null
  isin?: string | null
  bond_id?: string | null
  sb_account_number?: string | null
  invested: number
  face_value?: number | null
  interest_rate?: number | null
  purchase_date?: string | null
  maturity_date?: string | null
}

export interface ZerodhaStock extends BaseRow {
  instrument: string
  qty: number
  prev_qty: number
  avg_cost: number
  // computed live
  _ltp?: number | null
  _name?: string | null
  _qty_diff?: number
  current_value?: number | null
  invested?: number
  _alloc_pct?: number | null
}

export interface AionionStock extends BaseRow {
  instrument: string
  qty: number
  prev_qty: number
  avg_cost: number
  _ltp?: number | null
  _name?: string | null
  _qty_diff?: number
  current_value?: number | null
  invested?: number
  _alloc_pct?: number | null
}

export interface AionionGold extends BaseRow {
  instrument: string
  qty: number
  avg_cost: number
  _ltp?: number | null
  current_value?: number | null
  invested?: number
  _alloc_pct?: number | null
}

export interface MfHolding extends BaseRow {
  fund_name: string
  qty: number
  prev_qty?: number | null
  avg_cost: number
  nav_symbol?: string | null
  _live_nav?: number | null
  _qty_diff?: number
  current_value?: number | null
  invested?: number
  _alloc_pct?: number | null
}

export interface GoldHolding extends BaseRow {
  holding_name: string
  holding_type: 'ETF' | 'MF'
  qty: number
  avg_cost: number
  yahoo_symbol?: string | null
  _ltp?: number | null
  current_value?: number | null
  invested?: number
  _alloc_pct?: number | null
}

export interface AmcMfHolding extends BaseRow {
  fund_name?: string | null
  scheme_code?: string | null
  platform?: string | null
  folio_number?: string | null
  qty: number
  avg_cost: number
  nav_symbol?: string | null
  _name?: string | null
  _live_nav?: number | null
  current_value?: number | null
  invested?: number
  _alloc_pct?: number | null
}

export interface ForeignStock extends BaseRow {
  symbol: string
  qty: number
  avg_price: number
  currency: string
  // live enrichment
  _unitPrice?: number | null
  _currentValue?: number | null
  _name?: string | null
}

export interface CryptoHolding extends BaseRow {
  yahoo_symbol: string
  platform: string
  qty: number
  avg_price_gbp: number
  // live enrichment
  _livePriceGbp?: number | null
  _name?: string | null
}

// ─── Allocation ──────────────────────────────────────────────
export interface IdealAllocation extends BaseRow {
  item: string
  type: string
  category: string
  percentage: number
}

// ─── Nav union ───────────────────────────────────────────────
export type AssetClass =
  | 'Cash'
  | 'Fixed Deposits'
  | 'Emergency Funds'
  | 'Bonds'
  | 'Zerodha Stocks'
  | 'Mutual Funds'
  | 'Gold'
  | 'Aionion Stocks'
  | 'Aionion Gold'
  | 'AMC Mutual Funds'
  | 'Foreign Stocks'
  | 'Crypto'

export const ASSET_TABLE_MAP: Record<AssetClass, string> = {
  'Cash':              'cash_assets',
  'Fixed Deposits':    'bank_fd_assets',
  'Emergency Funds':   'emergency_funds',
  'Bonds':             'bonds',
  'Zerodha Stocks':    'zerodha_stocks',
  'Mutual Funds':      'mf_holdings',
  'Gold':              'gold_holdings',
  'Aionion Stocks':    'aionion_stocks',
  'Aionion Gold':      'aionion_gold',
  'AMC Mutual Funds':  'amc_mf_holdings',
  'Foreign Stocks':    'foreign_stock_holdings',
  'Crypto':            'crypto_holdings',
}

export const ASSET_ACTUAL_TABLE_MAP: Partial<Record<AssetClass, string>> = {
  'Fixed Deposits':    'fd_actual_invested',
  'Emergency Funds':   'ef_actual_invested',
  'Zerodha Stocks':    'zerodha_actual_invested',
  'Mutual Funds':      'mf_actual_invested',
  'Aionion Stocks':    'aionion_actual_invested',
  'Aionion Gold':      'aionion_gold_actual_invested',
  'AMC Mutual Funds':  'amc_mf_actual_invested',
  'Foreign Stocks':    'foreign_actual_invested',
  'Crypto':            'crypto_actual_invested',
  'Gold':              'gold_actual_invested',
}

// Slug ↔ AssetClass
export const SLUG_TO_CLASS: Record<string, AssetClass> = {
  'cash':               'Cash',
  'fixed-deposits':     'Fixed Deposits',
  'emergency-funds':    'Emergency Funds',
  'bonds':              'Bonds',
  'zerodha-stocks':     'Zerodha Stocks',
  'mutual-funds':       'Mutual Funds',
  'gold':               'Gold',
  'aionion-stocks':     'Aionion Stocks',
  'aionion-gold':       'Aionion Gold',
  'amc-mutual-funds':   'AMC Mutual Funds',
  'foreign-stocks':     'Foreign Stocks',
  'crypto':             'Crypto',
}

export const CLASS_TO_SLUG: Record<AssetClass, string> = Object.fromEntries(
  Object.entries(SLUG_TO_CLASS).map(([k, v]) => [v, k])
) as Record<AssetClass, string>
