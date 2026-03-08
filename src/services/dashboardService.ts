import { supabase } from '../lib/supabase'
import type { DashboardStats } from '../types'

interface PriceEntry { price: number; name: string | null }
type PriceMap = Record<string, PriceEntry>

async function fetchLivePrices(instruments: string[]): Promise<PriceMap> {
  if (!instruments.length) return {}
  const symbols = instruments.map(i => `${i}.NS`).join(',')
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`)
    if (!res.ok) return {}
    return await res.json()
  } catch { return {} }
}

const getLTP = (map: PriceMap, instrument: string): number | null =>
  map[instrument]?.price ?? null

export async function loadDashboardStats(userId: string): Promise<DashboardStats> {
  const FD_LIKE = ['bank_fd_assets', 'emergency_funds']

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

  let totalInvested = 0, totalValue = 0, assetCount = 0

  // Cash
  ;(cashRes.data ?? []).forEach(r => {
    totalInvested += +r.invested || 0
    totalValue    += +r.current_value || 0
    assetCount++
  })

  // FD-like (no live value — current = invested)
  ;[...(fdRes.data ?? []), ...(efRes.data ?? [])].forEach(r => {
    const inv = +r.invested || 0
    totalInvested += inv
    totalValue    += inv
    assetCount++
  })

  // Bonds: current value = face_value
  ;(bondsRes.data ?? []).forEach(r => {
    totalInvested += +r.invested || 0
    totalValue    += +r.face_value || +r.invested || 0
    assetCount++
  })

  // AMC MF — no live nav yet, use avg_cost
  ;(amcMfRes.data ?? []).forEach(r => {
    const val = (+r.qty || 0) * (+r.avg_cost || 0)
    totalInvested += val; totalValue += val; assetCount++
  })

  // MF — no live nav yet
  ;(mfRes.data ?? []).forEach(r => {
    const val = (+r.qty || 0) * (+r.avg_cost || 0)
    totalInvested += val; totalValue += val; assetCount++
  })

  // Gold — no live nav yet
  ;(goldRes.data ?? []).forEach(r => {
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

  const fdCount  = (fdActualRes.data  ?? []).length
  const zaiCount = (zaiRes.data  ?? []).length
  const aaiCount = (aaiRes.data  ?? []).length
  const agaiCount= (agaiRes.data ?? []).length
  const mfaiCount= (mfaiRes.data ?? []).length
  const gaiCount = (gaiRes.data  ?? []).length

  const actualInvested =
    sum(fdActualRes.data)  + sum(efActualRes.data) +
    sum(zaiRes.data)       + sum(aaiRes.data)       +
    sum(agaiRes.data)      + sum(mfaiRes.data)      +
    sum(gaiRes.data)

  const total = fdCount + zaiCount + aaiCount + agaiCount + mfaiCount + gaiCount
  const entryLabel = `${fdCount} FD · ${zaiCount} Zerodha · ${aaiCount} Aionion · ${mfaiCount} MF · ${gaiCount} Gold entr${total !== 1 ? 'ies' : 'y'}`

  return { totalValue, totalInvested, actualInvested, assetCount, entryLabel }
}
