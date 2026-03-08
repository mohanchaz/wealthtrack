import { supabase } from '../lib/supabase'
import { fetchLivePrices, getLTP } from './priceService'
import type { DashboardStats } from '../types'

export async function loadDashboardStats(userId: string): Promise<DashboardStats> {
  const [
    cashRes, fdRes, efRes, bondsRes, amcMfRes,
    zerodhaRes, aionionRes, aionionGoldRes, mfRes, goldRes,
    fdActualRes, efActualRes, zaiRes, aaiRes, agaiRes, mfaiRes, gaiRes,
  ] = await Promise.all([
    supabase.from('cash_assets').select('invested, current_value').eq('user_id', userId),
    supabase.from('bank_fd_assets').select('invested').eq('user_id', userId),
    supabase.from('emergency_funds').select('invested').eq('user_id', userId),
    supabase.from('bonds').select('invested, face_value').eq('user_id', userId),
    supabase.from('amc_mf_holdings').select('qty, avg_cost').eq('user_id', userId),
    supabase.from('zerodha_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
    supabase.from('aionion_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
    supabase.from('aionion_gold').select('qty, avg_cost, instrument').eq('user_id', userId),
    supabase.from('mf_holdings').select('qty, avg_cost').eq('user_id', userId),
    supabase.from('gold_holdings').select('qty, avg_cost').eq('user_id', userId),
    supabase.from('fd_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('ef_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('zerodha_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('aionion_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('aionion_gold_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('mf_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('gold_actual_invested').select('amount').eq('user_id', userId),
  ])

  let totalInvested = 0
  let totalValue    = 0
  let assetCount    = 0

  // Cash
  ;(cashRes.data ?? []).forEach(r => {
    totalInvested += +r.invested || 0
    totalValue    += +r.current_value || 0
    assetCount++
  })

  // FD-like (current = invested)
  ;[...(fdRes.data ?? []), ...(efRes.data ?? [])].forEach(r => {
    const inv = +r.invested || 0
    totalInvested += inv; totalValue += inv; assetCount++
  })

  // Bonds (current = face_value)
  ;(bondsRes.data ?? []).forEach(r => {
    totalInvested += +r.invested || 0
    totalValue    += +r.face_value || +r.invested || 0
    assetCount++
  })

  // AMC MF / MF / Gold — no live NAV yet, use avg_cost
  ;[...(amcMfRes.data ?? []), ...(mfRes.data ?? []), ...(goldRes.data ?? [])].forEach(r => {
    const val = (+r.qty || 0) * (+r.avg_cost || 0)
    totalInvested += val; totalValue += val; assetCount++
  })

  // Zerodha stocks — fetch live prices
  const zerodhaAssets = zerodhaRes.data ?? []
  const zPrices = await fetchLivePrices(zerodhaAssets.map(r => r.instrument))
  zerodhaAssets.forEach(r => {
    const qty = +r.qty || 0
    const ltp = getLTP(zPrices, r.instrument) ?? +r.avg_cost
    totalInvested += qty * (+r.avg_cost || 0)
    totalValue    += qty * ltp
    assetCount++
  })

  // Aionion stocks
  const aionionAssets = aionionRes.data ?? []
  const aPrices = await fetchLivePrices(aionionAssets.map(r => r.instrument))
  aionionAssets.forEach(r => {
    const qty = +r.qty || 0
    const ltp = getLTP(aPrices, r.instrument) ?? +r.avg_cost
    totalInvested += qty * (+r.avg_cost || 0)
    totalValue    += qty * ltp
    assetCount++
  })

  // Aionion Gold
  const agAssets = aionionGoldRes.data ?? []
  const agPrices = await fetchLivePrices(agAssets.map(r => r.instrument))
  agAssets.forEach(r => {
    const qty = +r.qty || 0
    const ltp = getLTP(agPrices, r.instrument) ?? +r.avg_cost
    totalInvested += qty * (+r.avg_cost || 0)
    totalValue    += qty * ltp
    assetCount++
  })

  // Actual invested totals
  const sum = (data: { amount: string | number }[] | null) =>
    (data ?? []).reduce((s, r) => s + (+r.amount || 0), 0)

  const actualInvested =
    sum(fdActualRes.data) + sum(efActualRes.data) + sum(zaiRes.data) +
    sum(aaiRes.data) + sum(agaiRes.data) + sum(mfaiRes.data) + sum(gaiRes.data)

  const fdCnt = (fdActualRes.data ?? []).length
  const zCnt  = (zaiRes.data ?? []).length
  const aCnt  = (aaiRes.data ?? []).length
  const mCnt  = (mfaiRes.data ?? []).length
  const gCnt  = (gaiRes.data ?? []).length
  const entryLabel = `${fdCnt} FD · ${zCnt} Zerodha · ${aCnt} Aionion · ${mCnt} MF · ${gCnt} Gold entries`

  return { totalValue, totalInvested, actualInvested, assetCount, entryLabel }
}
