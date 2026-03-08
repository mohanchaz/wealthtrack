import { supabase } from '../lib/supabase'
import type { ActualInvestedRow } from '../types/assets'

export async function loadActualInvested(table: string, userId: string): Promise<ActualInvestedRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as ActualInvestedRow[]
}

export async function saveActualInvested(
  table: string,
  userId: string,
  row: { id?: string; entry_date: string; amount: number; notes?: string },
): Promise<void> {
  if (row.id) {
    const { error } = await supabase
      .from(table)
      .update({ entry_date: row.entry_date, amount: row.amount, notes: row.notes ?? null })
      .eq('id', row.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from(table)
      .insert({ user_id: userId, entry_date: row.entry_date, amount: row.amount, notes: row.notes ?? null })
    if (error) throw error
  }
}

export async function deleteActualInvested(table: string, ids: string[]): Promise<void> {
  for (const id of ids) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  }
}
