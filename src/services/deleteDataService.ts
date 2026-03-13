import { supabase } from '../lib/supabase'

const ALL_TABLES = [
  'zerodha_stocks', 'aionion_stocks', 'aionion_gold',
  'mf_holdings', 'gold_holdings', 'amc_mf_holdings',
  'cash_assets', 'bank_fd_assets', 'emergency_funds',
  'bonds', 'foreign_stock_holdings', 'crypto_holdings',
  'bank_savings',
  'bank_savings_actual_invested', 'crypto_actual_invested',
  'foreign_actual_invested', 'ideal_allocations',
  'networth_snapshots',
] as const

export async function deleteAllUserData(userId: string): Promise<void> {
  const errors: string[] = []

  for (const table of ALL_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    if (error) errors.push(`${table}: ${error.message}`)
  }

  if (errors.length > 0) {
    throw new Error(`Some tables failed to clear:\n${errors.join('\n')}`)
  }
}
