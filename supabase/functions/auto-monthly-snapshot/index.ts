/**
 * shared.ts — shared logic for both edge functions
 * - CSV builder
 * - Email HTML builder
 * - Snapshot calculator
 * - Email sender
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Table list for CSV backup ────────────────────────────────────────────────
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
  { table: 'bonds_actual_invested',        label: 'Bonds Actual Invested' },
  { table: 'bank_savings_actual_invested', label: 'Bank Savings Actual Invested' },
  { table: 'crypto_actual_invested',       label: 'Crypto Actual Invested' },
  { table: 'foreign_actual_invested',      label: 'Foreign Actual Invested' },
  { table: 'ideal_allocations',            label: 'Ideal Allocations' },
  { table: 'networth_snapshots',           label: 'Networth Snapshots' },
]

// ── Formatter ────────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

// ── CSV builder ──────────────────────────────────────────────────────────────
function buildCSV(tables: Record<string, Record<string, unknown>[]>): string {
  const sheets: string[] = []
  for (const def of TABLE_DEFS) {
    const rows = tables[def.table] ?? []
    if (!rows.length) continue
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
    sheets.push(`### ${def.label} (${def.table})\n${header}\n${body}`)
  }
  return sheets.join('\n\n')
}

// ── Snapshot data type ───────────────────────────────────────────────────────
interface SnapshotData {
  month:          string
  netWorth:       number
  invested:       number
  actualInvested: number
  status:         'saved' | 'skipped' | 'none'
}

// ── Compute snapshot values for a user ──────────────────────────────────────
async function computeSnapshot(
  supabase: ReturnType<typeof createClient>,
  userId:   string,
  month:    string,
): Promise<SnapshotData> {
  const GBP_INR = 107.0

  // Check if snapshot already exists
  const { data: existing } = await supabase
    .from('networth_snapshots')
    .select('net_worth,invested,actual_invested')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    return {
      month,
      netWorth:       existing.net_worth,
      invested:       existing.invested,
      actualInvested: existing.actual_invested,
      status:         'skipped',
    }
  }

  // Fetch all asset tables
  const [
    { data: zStocks  = [] }, { data: aiStocks = [] },
    { data: zMfs     = [] }, { data: amcMf    = [] },
    { data: zGold    = [] }, { data: aiGold   = [] },
    { data: cash     = [] }, { data: fds      = [] },
    { data: ef       = [] }, { data: bonds    = [] },
    { data: foreign  = [] }, { data: crypto   = [] },
    { data: bankSav  = [] },
  ] = await Promise.all([
    supabase.from('zerodha_stocks').select('qty,avg_cost').eq('user_id', userId),
    supabase.from('aionion_stocks').select('qty,avg_cost').eq('user_id', userId),
    supabase.from('mf_holdings').select('qty,avg_cost').eq('user_id', userId),
    supabase.from('amc_mf_holdings').select('qty,avg_cost').eq('user_id', userId),
    supabase.from('gold_holdings').select('qty,avg_cost').eq('user_id', userId),
    supabase.from('aionion_gold').select('qty,avg_cost').eq('user_id', userId),
    supabase.from('cash_assets').select('invested,current_value').eq('user_id', userId),
    supabase.from('bank_fd_assets').select('invested').eq('user_id', userId),
    supabase.from('emergency_funds').select('invested').eq('user_id', userId),
    supabase.from('bonds').select('invested,face_value').eq('user_id', userId),
    supabase.from('foreign_stock_holdings').select('qty,avg_price,currency').eq('user_id', userId),
    supabase.from('crypto_holdings').select('qty,avg_price_gbp').eq('user_id', userId),
    supabase.from('bank_savings').select('amount_gbp').eq('user_id', userId),
  ])

  const sumQA = (rows: any[]) =>
    rows.reduce((s: number, r: any) => s + Number(r.qty) * Number(r.avg_cost), 0)

  const cashInv    = (cash    as any[]).reduce((s, r) => s + Number(r.current_value ?? r.invested), 0)
  const fdInv      = (fds     as any[]).reduce((s, r) => s + Number(r.invested), 0)
  const efInv      = (ef      as any[]).reduce((s, r) => s + Number(r.invested), 0)
  const bondsInv   = (bonds   as any[]).reduce((s, r) => s + Number(r.face_value ?? r.invested), 0)
  const foreignInv = (foreign as any[]).reduce((s, r) => {
    const cur  = r.currency ?? 'GBP'
    const rate = cur === 'GBX' ? GBP_INR / 100 : cur === 'USD' ? GBP_INR / 1.27 : GBP_INR
    return s + Number(r.qty) * Number(r.avg_price) * rate
  }, 0)
  const cryptoInv = (crypto  as any[]).reduce((s, r) => s + Number(r.qty) * Number(r.avg_price_gbp) * GBP_INR, 0)
  const bankInv   = (bankSav as any[]).reduce((s, r) => s + Number(r.amount_gbp) * GBP_INR, 0)

  const totalInvested =
    sumQA(zStocks as any)  + sumQA(aiStocks as any) +
    sumQA(zMfs    as any)  + sumQA(amcMf   as any)  +
    sumQA(zGold   as any)  + sumQA(aiGold  as any)  +
    cashInv + fdInv + efInv + bondsInv +
    foreignInv + cryptoInv + bankInv

  if (totalInvested === 0) {
    return { month, netWorth: 0, invested: 0, actualInvested: 0, status: 'none' }
  }

  // Fetch actual invested tables
  const [
    { data: actZS = [] }, { data: actZM = [] }, { data: actAI = [] },
    { data: actAM = [] }, { data: actFD = [] }, { data: actEF = [] },
    { data: actB  = [] }, { data: actCr = [] }, { data: actFo = [] },
    { data: actBk = [] },
  ] = await Promise.all([
    supabase.from('zerodha_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('mf_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('aionion_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('amc_mf_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('fd_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('ef_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('bonds_actual_invested').select('amount').eq('user_id', userId),
    supabase.from('crypto_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId),
    supabase.from('foreign_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId),
    supabase.from('bank_savings_actual_invested').select('gbp_amount,inr_rate').eq('user_id', userId),
  ])

  const sumAmt = (rows: any[]) => rows.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const sumGbp = (rows: any[]) => rows.reduce((s: number, r: any) =>
    s + Number(r.gbp_amount) * Number(r.inr_rate ?? GBP_INR), 0)

  const actualInvested =
    sumAmt(actZS as any) + sumAmt(actZM as any) + sumAmt(actAI as any) +
    sumAmt(actAM as any) + sumAmt(actFD as any) + sumAmt(actEF as any) +
    sumAmt(actB  as any) + sumGbp(actCr as any) + sumGbp(actFo as any) +
    sumGbp(actBk as any) + cashInv + bondsInv

  return {
    month,
    netWorth:       Math.round(totalInvested),
    invested:       Math.round(totalInvested),
    actualInvested: Math.round(actualInvested),
    status:         'saved',
  }
}

// ── Save snapshot to DB ──────────────────────────────────────────────────────
async function saveSnapshot(
  supabase:  ReturnType<typeof createClient>,
  userId:    string,
  snap:      SnapshotData,
): Promise<void> {
  const { error } = await supabase
    .from('networth_snapshots')
    .insert({
      user_id:         userId,
      month:           snap.month,
      net_worth:       snap.netWorth,
      invested:        snap.invested,
      actual_invested: snap.actualInvested,
    })
  if (error) throw new Error(error.message)
}

// ── Build + send email ───────────────────────────────────────────────────────
async function sendEmail(params: {
  userName:       string
  recipientEmail: string
  exportDate:     string
  fileName:       string
  csvBase64:      string
  totalRows:      number
  tableStats:     { label: string; rows: number }[]
  snap:           SnapshotData | null   // null = no snapshot section
}): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')!
  const resendFrom   = Deno.env.get('RESEND_FROM')!

  const { userName, recipientEmail, exportDate, fileName, csvBase64, totalRows, tableStats, snap } = params

  const monthName = snap
    ? new Date(snap.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : ''

  const statRows = tableStats
    .filter(t => t.rows > 0)
    .map(t => `
      <tr>
        <td style="padding:8px 16px;font-size:12px;color:#444;border-bottom:1px solid #f0ede8;">${t.label}</td>
        <td style="padding:8px 16px;font-size:12px;color:#0F766E;font-weight:700;text-align:right;border-bottom:1px solid #f0ede8;">${t.rows} rows</td>
      </tr>`).join('')

  // Snapshot section — only shown in monthly cron email
  const snapshotSection = snap ? `
  <tr>
    <td style="background:#ffffff;padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0DDD6;border-radius:12px;overflow:hidden;">
        <tr>
          <td colspan="3" style="padding:12px 20px;background:#F5F4F0;border-bottom:1px solid #E0DDD6;">
            <table width="100%"><tr>
              <td style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">
                SNAPSHOT · ${monthName}
              </td>
              <td align="right">
                ${snap.status === 'saved'
                  ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ AUTO-SAVED</span>`
                  : `<span style="background:#fef9c3;color:#854d0e;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;">MANUAL SNAPSHOT EXISTS</span>`
                }
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;border-right:1px solid #E0DDD6;text-align:center;">
            <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:4px;">BOOK VALUE</div>
            <div style="font-size:20px;font-weight:900;color:#0F766E;">${fmtINR(snap.netWorth)}</div>
          </td>
          <td style="padding:16px 20px;border-right:1px solid #E0DDD6;text-align:center;">
            <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:4px;">INVESTED</div>
            <div style="font-size:20px;font-weight:900;color:#1A1A1A;">${fmtINR(snap.invested)}</div>
          </td>
          <td style="padding:16px 20px;text-align:center;">
            <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:4px;">ACTUAL INV.</div>
            <div style="font-size:20px;font-weight:900;color:#D97706;">${snap.actualInvested > 0 ? fmtINR(snap.actualInvested) : '—'}</div>
          </td>
        </tr>
        ${snap.status === 'saved' ? `
        <tr>
          <td colspan="3" style="padding:10px 20px;background:#fffbeb;border-top:1px solid #E0DDD6;">
            <p style="margin:0;font-size:11px;color:#92400e;">
              📸 Book-value snapshot. Open INFolio and hit <strong>Snapshot</strong> on the dashboard to update with live prices.
            </p>
          </td>
        </tr>` : ''}
      </table>
    </td>
  </tr>` : ''

  const subject = snap
    ? `INFolio · Monthly Report — ${monthName}`
    : `INFolio · Portfolio Backup — ${exportDate}`

  const greeting = snap
    ? `Your monthly INFolio report is ready. A snapshot has been recorded for ${monthName} and your full portfolio backup is attached.`
    : `Your full portfolio backup is attached as a CSV file. You can restore it anytime from Settings → Import.`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#0D4F4A 0%,#0F766E 55%,#14B8A6 100%);border-radius:16px 16px 0 0;padding:28px 32px;">
      <table width="100%"><tr>
        <td>
          <table cellpadding="0" cellspacing="0" style="display:inline-table;"><tr>
            <td style="background:rgba(255,255,255,0.15);border-radius:10px;width:42px;height:42px;text-align:center;vertical-align:middle;font-size:20px;font-weight:900;color:#99F6E4;">C</td>
            <td style="padding-left:10px;vertical-align:middle;">
              <span style="font-size:22px;font-weight:800;color:#fff;">INFolio</span><span style="font-size:26px;font-weight:800;color:#2ECC71;">.</span>
              <div style="font-size:8px;color:rgba(255,255,255,0.5);letter-spacing:3px;margin-top:2px;">PORTFOLIO INTELLIGENCE</div>
            </td>
          </tr></table>
        </td>
        <td align="right" style="vertical-align:middle;">
          <span style="background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 12px;font-size:11px;color:rgba(255,255,255,0.8);letter-spacing:1px;">
            ${snap ? 'MONTHLY REPORT' : 'BACKUP'}
          </span>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:28px 32px 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">INFOLIO · ${exportDate}</p>
      <h1 style="margin:0;font-size:22px;font-weight:900;color:#1A1A1A;">Hi, ${userName} 👋</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#767676;line-height:1.6;">${greeting}</p>
    </td>
  </tr>

  ${snapshotSection}

  <tr>
    <td style="background:#ffffff;padding:0 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:16px 20px;border-bottom:1px solid #E0DDD6;">
          <span style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">BACKUP SUMMARY</span>
        </td></tr>
        <tr><td>
          <table width="100%"><tr>
            <td style="padding:14px 20px;border-right:1px solid #E0DDD6;text-align:center;">
              <div style="font-size:24px;font-weight:900;color:#0F766E;">${totalRows}</div>
              <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px;">TOTAL ROWS</div>
            </td>
            <td style="padding:14px 20px;border-right:1px solid #E0DDD6;text-align:center;">
              <div style="font-size:24px;font-weight:900;color:#1A1A1A;">${tableStats.filter(t => t.rows > 0).length}</div>
              <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px;">TABLES</div>
            </td>
            <td style="padding:14px 20px;text-align:center;">
              <div style="font-size:24px;font-weight:900;color:#aaa;">${tableStats.filter(t => t.rows === 0).length}</div>
              <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px;">EMPTY</div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0DDD6;border-radius:12px;overflow:hidden;">
        <tr><td colspan="2" style="padding:12px 16px;background:#F5F4F0;border-bottom:1px solid #E0DDD6;">
          <span style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">BREAKDOWN</span>
        </td></tr>
        ${statRows}
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:0 32px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1A7A3C;">💡 To restore this backup</p>
          <p style="margin:0;font-size:12px;color:#444;line-height:1.5;">Open INFolio → Settings → <strong>Import &amp; restore</strong> → choose this CSV file.</p>
        </td></tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:linear-gradient(135deg,#0D4F4A 0%,#0F766E 55%,#14B8A6 100%);border-radius:0 0 16px 16px;padding:20px 32px;">
      <table width="100%"><tr>
        <td style="font-size:11px;color:rgba(255,255,255,0.6);">
          <strong style="color:rgba(255,255,255,0.9);">INFolio</strong> · Chaz Tech Ltd. · © 2026
        </td>
        <td align="right" style="font-size:11px;color:rgba(255,255,255,0.5);">🔒 Secure &amp; Private</td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:        `INFolio <${resendFrom}>`,
      to:          [recipientEmail],
      subject,
      html,
      attachments: [{ filename: fileName, content: csvBase64 }],
    }),
  })

  const resendData = await resendRes.json()
  if (!resendRes.ok) throw new Error(resendData.message ?? 'Resend API error')
}

// ── Fetch all tables + build CSV for a user ──────────────────────────────────
async function fetchAndBuildCSV(
  supabase: ReturnType<typeof createClient>,
  userId:   string,
): Promise<{ csv: string; tableStats: { label: string; rows: number }[]; totalRows: number }> {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const tableStats: { label: string; rows: number }[] = []

  for (const def of TABLE_DEFS) {
    const { data } = await supabase.from(def.table).select('*').eq('user_id', userId)
    const rows = (data ?? []) as Record<string, unknown>[]
    tables[def.table] = rows
    tableStats.push({ label: def.label, rows: rows.length })
  }

  const totalRows = tableStats.reduce((s, t) => s + t.rows, 0)
  const csv       = buildCSV(tables)
  return { csv, tableStats, totalRows }
}

/**
 * auto-monthly-snapshot
 *
 * Triggered by pg_cron on the 1st of every month at 02:00 UTC.
 * For every user:
 *   1. Saves a book-value snapshot for the current month (skips if already exists)
 *   2. Sends the monthly report email with snapshot summary + CSV backup attached
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'


const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase       = createClient(supabaseUrl, serviceRoleKey)

    // Target: current month (cron runs on the 1st)
    const now   = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    console.log(`[auto-snapshot] Running for month: ${month}`)

    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
    if (usersErr) throw new Error(`Failed to list users: ${usersErr.message}`)

    const results = []

    for (const user of users.users) {
      const userId    = user.id
      const userEmail = user.email ?? ''
      const userName  = user.user_metadata?.full_name ?? userEmail.split('@')[0] ?? 'there'

      try {
        // 1. Compute + save snapshot
        const snap = await computeSnapshot(supabase, userId, month)

        if (snap.status === 'saved') {
          await saveSnapshot(supabase, userId, snap)
          console.log(`[auto-snapshot] ✅ Snapshot saved for ${userId}`)
        } else if (snap.status === 'none') {
          results.push({ userId, snapshot: 'skipped (no assets)', email: 'skipped' })
          continue
        }

        // 2. Build CSV + send email
        if (!userEmail) {
          results.push({ userId, snapshot: snap.status, email: 'skipped (no email)' })
          continue
        }

        const exportDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        const fileName   = `infolio-backup-${now.toISOString().slice(0, 10)}.csv`
        const { csv, tableStats, totalRows } = await fetchAndBuildCSV(supabase, userId)
        const csvBase64  = btoa(unescape(encodeURIComponent(csv)))

        await sendEmail({
          userName,
          recipientEmail: userEmail,
          exportDate,
          fileName,
          csvBase64,
          totalRows,
          tableStats,
          snap,  // snapshot section shown in email
        })

        results.push({ userId, snapshot: snap.status, email: 'sent' })
        console.log(`[auto-snapshot] ✅ Email sent to ${userEmail}`)

      } catch (err: any) {
        results.push({ userId, snapshot: 'error', email: 'error', error: err.message })
        console.error(`[auto-snapshot] ❌ ${userId}:`, err.message)
      }
    }

    const saved   = results.filter(r => r.snapshot === 'saved').length
    const skipped = results.filter(r => r.snapshot === 'skipped').length
    const emailed = results.filter(r => r.email === 'sent').length

    return new Response(JSON.stringify({ month, saved, skipped, emailed, results }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (err: any) {
    console.error('[auto-snapshot] Fatal:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})