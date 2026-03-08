import { supabase } from '../lib/supabase'

export type ActualTable =
  | 'fd_actual_invested'
  | 'ef_actual_invested'
  | 'zerodha_actual_invested'
  | 'aionion_actual_invested'
  | 'aionion_gold_actual_invested'
  | 'mf_actual_invested'
  | 'gold_actual_invested'
  | 'foreign_actual_invested'
  | 'crypto_actual_invested'

export interface ActualEntry {
  id:          string
  user_id:     string
  amount:      number
  note?:       string
  created_at?: string
}

export async function fetchActualInvested(
  table:  ActualTable,
  userId: string,
): Promise<ActualEntry[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ActualEntry[]
}

export async function addActualEntry(
  table:  ActualTable,
  userId: string,
  amount: number,
  note?:  string,
): Promise<void> {
  const payload: Record<string, unknown> = { user_id: userId, amount }
  if (note) payload.note = note
  const { error } = await supabase.from(table).insert(payload)
  if (error) throw new Error(error.message)
}

export async function deleteActualEntry(table: ActualTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
