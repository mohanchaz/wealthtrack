import { supabase } from '../lib/supabase'

export type ActualTable =
  | 'fd_actual_invested'
  | 'ef_actual_invested'
  | 'amc_mf_actual_invested'
  | 'zerodha_actual_invested'
  | 'aionion_actual_invested'
  | 'mf_actual_invested'
  // foreign_actual_invested has custom schema (gbp_amount+inr_rate) — handled in ForeignStocksPage directly
  // crypto_actual_invested has custom schema (gbp_amount+inr_rate) — handled in CryptoPage directly

export interface ActualEntry {
  id:           string
  user_id:      string
  amount:       number
  entry_date?:  string
  created_at?:  string
}

export async function fetchActualInvested(
  table:  ActualTable,
  userId: string,
): Promise<ActualEntry[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ActualEntry[]
}

export async function addActualEntry(
  table:      ActualTable,
  userId:     string,
  amount:     number,
  entryDate?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { user_id: userId, amount }
  if (entryDate) payload.entry_date = entryDate
  const { error } = await supabase.from(table).insert(payload)
  if (error) throw new Error(error.message)
}

export async function deleteActualEntry(table: ActualTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateActualEntry(
  table:      ActualTable,
  id:         string,
  amount:     number,
  entryDate?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { amount }
  if (entryDate) payload.entry_date = entryDate
  const { error } = await supabase.from(table).update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}
