import { supabase } from '../lib/supabase'

/** Generic load for any asset table */
export async function loadAssets<T>(table: string, userId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as T[]
}

/** Generic upsert (insert or update by id) */
export async function upsertAsset(
  table: string,
  userId: string,
  row: Record<string, unknown>,
): Promise<void> {
  const id = row.id as string | undefined
  if (id) {
    const payload = { ...row }
    delete payload.id
    delete payload.user_id
    delete payload.created_at
    const { error } = await supabase.from(table).update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(table).insert({ ...row, user_id: userId })
    if (error) throw error
  }
}

/** Generic delete */
export async function deleteAssets(table: string, ids: string[]): Promise<void> {
  for (const id of ids) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  }
}

// ─── Zerodha CSV import ─────────────────────────────────────
interface ZerodhaCSVRow {
  instrument: string
  qty: number
  avg_cost: number
}

export function parseZerodhaCSV(text: string): ZerodhaCSVRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const idx = {
    instrument: header.findIndex(h => h.includes('instrument') || h.includes('symbol')),
    qty: header.findIndex(h => h === 'quantity' || h === 'qty'),
    avg: header.findIndex(h => h.includes('average') || h.includes('avg')),
  }
  return lines
    .slice(1)
    .map(line => {
      const cols = line.split(',')
      const instrument = cols[idx.instrument]?.trim() ?? ''
      const qty = parseFloat(cols[idx.qty]) || 0
      const avg_cost = parseFloat(cols[idx.avg]) || 0
      return { instrument, qty, avg_cost }
    })
    .filter(r => r.instrument && r.qty > 0)
    .filter(r => !r.instrument.includes('MF') && !r.instrument.includes('GOLDBEES') && !r.instrument.match(/^GOLD/i))
}

export async function importZerodhaCSV(
  userId: string,
  rows: ZerodhaCSVRow[],
): Promise<void> {
  for (const row of rows) {
    const { data: existing } = await supabase
      .from('zerodha_stocks')
      .select('id, qty')
      .eq('user_id', userId)
      .eq('instrument', row.instrument)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('zerodha_stocks')
        .update({ prev_qty: existing.qty, qty: row.qty, avg_cost: row.avg_cost })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('zerodha_stocks')
        .insert({ user_id: userId, instrument: row.instrument, qty: row.qty, prev_qty: 0, avg_cost: row.avg_cost })
    }
  }
}

// ─── Aionion CSV import (same format as Zerodha) ────────────
export function parseAionionCSV(text: string): ZerodhaCSVRow[] {
  return parseZerodhaCSV(text)
}

export async function importAionionCSV(userId: string, rows: ZerodhaCSVRow[]): Promise<void> {
  for (const row of rows) {
    const { data: existing } = await supabase
      .from('aionion_stocks')
      .select('id, qty')
      .eq('user_id', userId)
      .eq('instrument', row.instrument)
      .maybeSingle()

    if (existing) {
      await supabase.from('aionion_stocks').update({ prev_qty: existing.qty, qty: row.qty, avg_cost: row.avg_cost }).eq('id', existing.id)
    } else {
      await supabase.from('aionion_stocks').insert({ user_id: userId, instrument: row.instrument, qty: row.qty, prev_qty: 0, avg_cost: row.avg_cost })
    }
  }
}

// ─── MF CSV import ───────────────────────────────────────────
interface MfCSVRow { fund_name: string; qty: number; avg_cost: number; nav_symbol?: string }

export function parseMfCSV(text: string): MfCSVRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const idx = {
    name: header.findIndex(h => h.includes('scheme') || h.includes('fund') || h.includes('name')),
    qty: header.findIndex(h => h === 'units' || h === 'qty' || h === 'quantity'),
    avg: header.findIndex(h => h.includes('average') || h.includes('avg') || h.includes('nav')),
    sym: header.findIndex(h => h.includes('symbol') || h.includes('ticker') || h.includes('isin')),
  }
  return lines.slice(1).map(line => {
    const cols = line.split(',')
    return {
      fund_name: cols[idx.name]?.trim() ?? '',
      qty: parseFloat(cols[idx.qty]) || 0,
      avg_cost: parseFloat(cols[idx.avg]) || 0,
      nav_symbol: idx.sym >= 0 ? cols[idx.sym]?.trim() : undefined,
    }
  }).filter(r => r.fund_name && r.qty > 0)
}

export async function importMfCSV(userId: string, rows: MfCSVRow[]): Promise<void> {
  for (const row of rows) {
    const { data: existing } = await supabase
      .from('mf_holdings')
      .select('id, qty')
      .eq('user_id', userId)
      .eq('fund_name', row.fund_name)
      .maybeSingle()

    const payload = { fund_name: row.fund_name, qty: row.qty, avg_cost: row.avg_cost, nav_symbol: row.nav_symbol ?? null }
    if (existing) {
      await supabase.from('mf_holdings').update({ prev_qty: existing.qty, ...payload }).eq('id', existing.id)
    } else {
      await supabase.from('mf_holdings').insert({ user_id: userId, prev_qty: 0, ...payload })
    }
  }
}

// ─── Generic CSV import for Gold / Foreign / Crypto ─────────
export function parseGenericCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const cols = line.split(',')
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cols[i]?.trim() ?? '' })
    return obj
  })
}
