import { supabase } from '../lib/supabase'

export type TableName =
  | 'zerodha_stocks' | 'aionion_stocks' | 'aionion_gold'
  | 'mf_holdings' | 'gold_holdings' | 'amc_mf_holdings'
  | 'cash_assets' | 'bank_fd_assets' | 'emergency_funds'
  | 'bonds' | 'foreign_stock_holdings' | 'crypto_holdings'

// Tables with no created_at column — order by their own timestamp or skip ordering
const ORDER_COL: Partial<Record<TableName, string>> = {
  mf_holdings: 'fund_name',   // alphabetical is fine for funds
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

/** Replace all rows for user (used by CSV import) */
export async function replaceAssets<T extends Record<string, unknown>>(
  table:  TableName,
  userId: string,
  rows:   T[],
): Promise<void> {
  const { error: delErr } = await supabase.from(table).delete().eq('user_id', userId)
  if (delErr) throw new Error(delErr.message)
  if (!rows.length) return
  const { error: insErr } = await supabase.from(table).insert(rows)
  if (insErr) throw new Error(insErr.message)
}
