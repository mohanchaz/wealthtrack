import { supabase } from '../lib/supabase'

export type TableName =
  | 'zerodha_stocks' | 'aionion_stocks' | 'aionion_gold'
  | 'mf_holdings' | 'gold_holdings' | 'amc_mf_holdings'
  | 'cash_assets' | 'bank_fd_assets' | 'emergency_funds'
  | 'bonds' | 'foreign_stock_holdings' | 'crypto_holdings'

// Tables with no created_at column — order by their own timestamp or skip ordering
const ORDER_COL: Partial<Record<TableName, string>> = {
  mf_holdings:    'fund_name',      // no created_at — order alphabetically
  gold_holdings:  'holding_name',   // no created_at — order alphabetically
  aionion_gold:   'instrument',     // no created_at
  aionion_stocks: 'instrument',     // no created_at — uses imported_at
}

export async function fetchAssets<T = Record<string, unknown>>(
  table:  TableName,
  userId: string,
): Promise<T[]> {
  const col = table in ORDER_COL ? ORDER_COL[table]! : 'created_at'
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
 *  Smart import logic for DIFF_TABLES:
 *  - Rows present in new import → upsert with prev_qty = old qty
 *  - Rows missing from new import → set qty=0, prev_qty=old qty (show as exited)
 *  - Rows where both prev_qty=0 AND qty=0 → delete (confirmed gone for 2 imports)
 *  - Non-diff tables → simple delete-all + insert
 */
export async function replaceAssets<T extends Record<string, unknown>>(
  table:  TableName,
  userId: string,
  rows:   T[],
): Promise<void> {
  // Tables that support prev_qty diff tracking
  const DIFF_TABLES: TableName[] = [
    'zerodha_stocks', 'aionion_stocks', 'aionion_gold',
    'mf_holdings', 'gold_holdings', 'amc_mf_holdings',
    'foreign_stock_holdings', 'crypto_holdings',
  ]

  if (!DIFF_TABLES.includes(table)) {
    // Simple replace for non-diff tables
    const { error: delErr } = await supabase.from(table).delete().eq('user_id', userId)
    if (delErr) throw new Error(delErr.message)
    if (rows.length) {
      const { error: insErr } = await supabase.from(table).insert(rows)
      if (insErr) throw new Error(insErr.message)
    }
    return
  }

  // ── Smart upsert for diff-tracked tables ───────────────────
  // 1. Fetch all existing rows
  const { data: existing, error: fetchErr } = await supabase
    .from(table).select('*').eq('user_id', userId)
  if (fetchErr) throw new Error(fetchErr.message)

  const existingRows = (existing ?? []) as Record<string, unknown>[]

  // Key function: covers all diff-tracked tables
  const rowKey = (r: Record<string, unknown>): string =>
    ((r.instrument ?? r.fund_name ?? r.holding_name ?? r.symbol ?? r.yahoo_symbol) as string) ?? ''

  // Build lookup maps
  const existingByKey = new Map<string, Record<string, unknown>>()
  for (const r of existingRows) {
    const k = rowKey(r)
    if (k) existingByKey.set(k, r)
  }

  const incomingByKey = new Map<string, T>()
  for (const r of rows) {
    const k = rowKey(r)
    if (k) incomingByKey.set(k, r)
  }

  const toUpsert: Record<string, unknown>[] = []
  const toDelete: string[] = []

  // 2. For each incoming row — upsert with prev_qty = current qty
  for (const [key, newRow] of incomingByKey) {
    const old = existingByKey.get(key)
    toUpsert.push({
      ...newRow,
      user_id:  userId,
      id:       old?.id,          // keep existing id so it's an update, not insert
      prev_qty: old ? Number(old.qty ?? 0) : 0,
    })
  }

  // 3. For each existing row NOT in the new import
  for (const [key, oldRow] of existingByKey) {
    if (incomingByKey.has(key)) continue  // handled above

    const oldQty  = Number(oldRow.qty     ?? 0)
    const oldPrev = Number(oldRow.prev_qty ?? 0)

    if (oldQty === 0 && oldPrev === 0) {
      // Already zeroed out in a previous import — safe to delete
      toDelete.push(oldRow.id as string)
    } else {
      // First time missing — zero it out, keep for visibility
      toUpsert.push({ ...oldRow, qty: 0, prev_qty: oldQty })
    }
  }

  // 4. Execute deletes
  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in('id', toDelete)
    if (error) throw new Error(error.message)
  }

  // 5. Execute upserts (insert new rows without id, update existing rows with id)
  const toInsert = toUpsert.filter(r => !r.id)
  const toUpdate = toUpsert.filter(r =>  r.id)

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
