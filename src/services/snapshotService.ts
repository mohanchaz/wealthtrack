import { supabase } from '../lib/supabase'

export interface NetWorthSnapshot {
  id:              string
  user_id:         string
  month:           string   // 'YYYY-MM'
  net_worth:       number
  invested:        number
  actual_invested: number
  created_at:      string
}

// Derived — never stored
export interface SnapshotWithDerived extends NetWorthSnapshot {
  gain:            number
  gain_pct:        number
  actual_gain:     number
  actual_gain_pct: number
}

export function deriveSnapshot(s: NetWorthSnapshot): SnapshotWithDerived {
  const gain            = s.net_worth - s.invested
  const gain_pct        = s.invested > 0 ? (gain / s.invested) * 100 : 0
  const actual_gain     = s.actual_invested > 0 ? s.net_worth - s.actual_invested : 0
  const actual_gain_pct = s.actual_invested > 0 ? (actual_gain / s.actual_invested) * 100 : 0
  return { ...s, gain, gain_pct, actual_gain, actual_gain_pct }
}

export async function loadSnapshots(userId: string): Promise<NetWorthSnapshot[]> {
  const { data, error } = await supabase
    .from('networth_snapshots')
    .select('id, user_id, month, net_worth, invested, actual_invested, created_at')
    .eq('user_id', userId)
    .order('month', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertSnapshot(
  userId: string,
  snapshot: { month: string; net_worth: number; invested: number; actual_invested: number }
): Promise<void> {
  const { error } = await supabase
    .from('networth_snapshots')
    .upsert(
      { user_id: userId, ...snapshot },
      { onConflict: 'user_id,month' }
    )
  if (error) throw new Error(error.message)
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { error } = await supabase
    .from('networth_snapshots')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
