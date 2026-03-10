import { supabase } from '../lib/supabase'

export type TableName =
  | 'zerodha_stocks' | 'aionion_stocks' | 'aionion_gold'
  | 'mf_holdings' | 'gold_holdings' | 'amc_mf_holdings'
  | 'cash_assets' | 'bank_fd_assets' | 'emergency_funds'
  | 'bonds' | 'foreign_stock_holdings' | 'crypto_holdings'

// Tables with no created_at column — order by their own timestamp or skip ordering
const ORDER_COL: Partial<Record<TableName, string>> = {
  mf_holdings:    'fund_name',      // no created_at — order alphabetically
  gold_holdings:  'yahoo_symbol',   // no created_at — order by yahoo_symbol
  aionion_gold:   'instrument',     // no created_at
  aionion_stocks: 'instrument',     // no created_at — uses imported_at
  crypto_holdings: 'updated_at',      // uses updated_at not created_at
}

export async function fetchAssets<T = Record<string, unknown>>(
  table:  TableName,
  userId: string,
): Promise<T[]> {
  const col = (table in ORDER_COL ? ORDER_COL[table] : 'created_at') ?? 'created_at'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order(col, { ascending: col === 'fund_name' })
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

export async function upsertAsset<T extends Record<string, unknown>>(
  table: TableName,
  row:   T,
): Promise<void> {
  const { error } = await supabase.from(table).upsert(row)
  if (error) throw new Error(error.message)
}

export async function deleteAsset(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Replace all rows for user (used by CSV import).
 *  Smart import for diff-tracked tables:
 *  - Rows in CSV → add new or update existing (with prev_qty = old qty)
 *  - Rows NOT in CSV → zero out qty (shows EXITED pill), preserve prev_qty
 *  - Nothing is ever deleted automatically — deletion is always manual
 */
export async function replaceAssets<T extends Record<string, unknown>>(
  table:  TableName,
  userId: string,
  rows:   T[],
): Promise<void> {
  const DIFF_TABLES: TableName[] = [
    'zerodha_stocks', 'aionion_stocks', 'aionion_gold',
    'mf_holdings', 'gold_holdings', 'amc_mf_holdings',
    'foreign_stock_holdings', 'crypto_holdings',
  ]

  if (!DIFF_TABLES.includes(table)) {
    // Non-diff tables: simple delete-all + insert
    const { error: delErr } = await supabase.from(table).delete().eq('user_id', userId)
    if (delErr) throw new Error(delErr.message)
    if (rows.length) {
      const { error: insErr } = await supabase.from(table).insert(rows)
      if (insErr) throw new Error(insErr.message)
    }
    return
  }

  // ── Fetch all existing rows ─────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from(table).select('*').eq('user_id', userId)
  if (fetchErr) throw new Error(fetchErr.message)

  const existingRows = (existing ?? []) as Record<string, unknown>[]

  const rowKey = (r: Record<string, unknown>): string =>
    ((r.instrument ?? r.fund_name ?? r.symbol ?? r.yahoo_symbol) as string) ?? ''

  const existingByKey = new Map<string, Record<string, unknown>>()
  for (const r of existingRows) {
    const k = rowKey(r)
    if (k) existingByKey.set(k, r)
  }

  const incomingKeys = new Set(rows.map(r => rowKey(r as Record<string, unknown>)))

  const toInsert: Record<string, unknown>[] = []
  const toUpdate: Record<string, unknown>[] = []

  // Rows in CSV → upsert with prev_qty = old qty
  for (const newRow of rows) {
    const key = rowKey(newRow as Record<string, unknown>)
    const old = existingByKey.get(key)
    const enriched = {
      ...newRow,
      user_id:  userId,
      prev_qty: old ? Number(old.qty ?? 0) : Number((newRow as Record<string, unknown>).qty ?? 0),
    }
    if (old?.id) {
      toUpdate.push({ ...enriched, id: old.id })
    } else {
      toInsert.push(enriched)
    }
  }

  // Rows NOT in CSV → zero qty, keep prev_qty = last known qty (never delete)
  for (const old of existingRows) {
    const key = rowKey(old)
    if (!key || incomingKeys.has(key)) continue
    const oldQty = Number(old.qty ?? 0)
    if (oldQty === 0) continue  // already zeroed, no-op
    toUpdate.push({ ...old, qty: 0, prev_qty: oldQty })
  }

  if (toInsert.length) {
    const clean = toInsert.map(({ id: _id, ...rest }) => rest)
    const { error } = await supabase.from(table).insert(clean)
    if (error) throw new Error(error.message)
  }

  if (toUpdate.length) {
    const { error } = await supabase.from(table).upsert(toUpdate)
    if (error) throw new Error(error.message)
  }
}
