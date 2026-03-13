import { supabase } from '../lib/supabase'

const ALL_TABLES = [
  // Main asset tables
  'zerodha_stocks', 'aionion_stocks', 'aionion_gold',
  'mf_holdings', 'gold_holdings', 'amc_mf_holdings',
  'cash_assets', 'bank_fd_assets', 'emergency_funds',
  'bonds', 'foreign_stock_holdings', 'crypto_holdings',
  'bank_savings',
  // Actual invested tables
  'zerodha_actual_invested',
  'mf_actual_invested',
  'amc_mf_actual_invested',
  'aionion_actual_invested',
  'fd_actual_invested',
  'ef_actual_invested',
  'bank_savings_actual_invested',
  'crypto_actual_invested',
  'foreign_actual_invested',
  // Other
  'ideal_allocations',
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
