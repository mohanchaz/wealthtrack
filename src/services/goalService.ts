import { supabase } from '../lib/supabase'

export interface Goal {
  id:            string
  user_id:       string
  target_amount: number
  deadline?:     string | null   // 'YYYY-MM-DD'
  created_at:    string
  updated_at:    string
}

export type GoalInput = Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>

/** Derive a human-readable title from the target amount — never stored in DB */
export function goalTitle(amount: number): string {
  if (amount >= 1e7) return `Reach ₹${(amount / 1e7).toFixed(amount % 1e7 === 0 ? 0 : 2)}Cr`
  if (amount >= 1e5) return `Reach ₹${(amount / 1e5).toFixed(amount % 1e5 === 0 ? 0 : 2)}L`
  if (amount >= 1e3) return `Reach ₹${(amount / 1e3).toFixed(amount % 1e3 === 0 ? 0 : 1)}K`
  return `Reach ₹${amount.toLocaleString('en-IN')}`
}

export async function loadGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createGoal(userId: string, input: GoalInput): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, ...input })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
