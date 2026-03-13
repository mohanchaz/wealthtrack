import { supabase } from '../lib/supabase'

const TABLE_DEFS = [
  { table: 'zerodha_stocks',               label: 'Zerodha Stocks' },
  { table: 'aionion_stocks',               label: 'Aionion Stocks' },
  { table: 'aionion_gold',                 label: 'Aionion Gold' },
  { table: 'mf_holdings',                  label: 'Mutual Funds' },
  { table: 'gold_holdings',                label: 'Gold Holdings' },
  { table: 'amc_mf_holdings',              label: 'AMC Mutual Funds' },
  { table: 'cash_assets',                  label: 'Cash Assets' },
  { table: 'bank_fd_assets',               label: 'Fixed Deposits' },
  { table: 'emergency_funds',              label: 'Emergency Fund' },
  { table: 'bonds',                        label: 'Bonds' },
  { table: 'foreign_stock_holdings',       label: 'Foreign Stocks' },
  { table: 'crypto_holdings',              label: 'Crypto' },
  { table: 'bank_savings',                 label: 'Bank Savings' },
  { table: 'zerodha_actual_invested',      label: 'Zerodha Actual Invested' },
  { table: 'mf_actual_invested',           label: 'MF Actual Invested' },
  { table: 'amc_mf_actual_invested',       label: 'AMC MF Actual Invested' },
  { table: 'aionion_actual_invested',      label: 'Aionion Actual Invested' },
  { table: 'fd_actual_invested',           label: 'FD Actual Invested' },
  { table: 'ef_actual_invested',           label: 'EF Actual Invested' },
  { table: 'bank_savings_actual_invested', label: 'Bank Savings Actual Invested' },
  { table: 'crypto_actual_invested',       label: 'Crypto Actual Invested' },
  { table: 'foreign_actual_invested',      label: 'Foreign Actual Invested' },
  { table: 'ideal_allocations',            label: 'Ideal Allocations' },
  { table: 'networth_snapshots',           label: 'Networth Snapshots' },
] as const

export type TableName = typeof TABLE_DEFS[number]['table']

export interface ExportBundle {
  version:    number
  exportedAt: string
  userId:     string
  tables:     Record<string, Record<string, unknown>[]>
}

export interface ImportResult {
  table:    string
  label:    string
  inserted: number
  error?:   string
}

// ── EXPORT ───────────────────────────────────────────────────────────────────

export async function exportAllData(userId: string): Promise<ExportBundle> {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const def of TABLE_DEFS) {
    const { data, error } = await supabase.from(def.table).select('*').eq('user_id', userId)
    if (error) throw new Error(`Failed to export ${def.table}: ${error.message}`)
    tables[def.table] = (data ?? []) as Record<string, unknown>[]
  }
  return { version: 1, exportedAt: new Date().toISOString(), userId, tables }
}

export function downloadJSON(bundle: ExportBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `infolio-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCSV(bundle: ExportBundle): void {
  const sheets: string[] = []
  for (const [tableName, rows] of Object.entries(bundle.tables)) {
    if (!rows.length) continue
    const def    = TABLE_DEFS.find(d => d.table === tableName)
    const label  = def?.label ?? tableName
    const cols   = Object.keys(rows[0])
    const header = cols.join(',')
    const body   = rows.map(row =>
      cols.map(c => {
        const v = row[c]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ).join('\n')
    sheets.push(`### ${label} (${tableName})\n${header}\n${body}`)
  }
  const blob = new Blob([sheets.join('\n\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `infolio-backup-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── IMPORT ───────────────────────────────────────────────────────────────────

function cleanRow(row: Record<string, unknown>, userId: string): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, updated_at, imported_at, ...rest } = row
  return { ...rest, user_id: userId }
}

export async function importFromJSON(bundle: ExportBundle, userId: string): Promise<ImportResult[]> {
  if (bundle.version !== 1) throw new Error('Unsupported backup version')
  const results: ImportResult[] = []
  for (const def of TABLE_DEFS) {
    const rows = bundle.tables[def.table]
    if (!rows || rows.length === 0) {
      results.push({ table: def.table, label: def.label, inserted: 0 })
      continue
    }
    await supabase.from(def.table).delete().eq('user_id', userId)
    const payloads = rows.map(r => cleanRow(r, userId))
    const { error } = await supabase.from(def.table).insert(payloads)
    if (error) results.push({ table: def.table, label: def.label, inserted: 0, error: error.message })
    else results.push({ table: def.table, label: def.label, inserted: payloads.length })
  }
  return results
}

export async function importFromCSV(csvText: string, userId: string): Promise<ImportResult[]> {
  const sectionPattern = /^### .+\(([^)]+)\)/gm
  const headers = [...csvText.matchAll(sectionPattern)].map(m => m[1].trim())
  const sections = csvText.split(/^### [^\n]+$/m).filter(s => s.trim())
  const results: ImportResult[] = []

  for (let i = 0; i < headers.length; i++) {
    const tableName = headers[i]
    const def       = TABLE_DEFS.find(d => d.table === tableName)
    const label     = def?.label ?? tableName
    const block     = sections[i]?.trim()
    if (!block) { results.push({ table: tableName, label, inserted: 0 }); continue }

    const lines = block.split('\n').filter(Boolean)
    if (lines.length < 2) { results.push({ table: tableName, label, inserted: 0 }); continue }

    const cols = lines[0].split(',')
    const rows: Record<string, unknown>[] = lines.slice(1).map(line => {
      const vals: string[] = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { vals.push(cur); cur = '' }
        else { cur += ch }
      }
      vals.push(cur)
      const obj: Record<string, unknown> = {}
      cols.forEach((col, idx) => { obj[col] = vals[idx] ?? '' })
      return obj
    })

    await supabase.from(tableName).delete().eq('user_id', userId)
    const payloads = rows.map(r => cleanRow(r, userId))
    const { error } = await supabase.from(tableName).insert(payloads)
    if (error) results.push({ table: tableName, label, inserted: 0, error: error.message })
    else results.push({ table: tableName, label, inserted: payloads.length })
  }
  return results
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result as string)
    r.onerror = () => rej(new Error('Failed to read file'))
    r.readAsText(file)
  })
}
