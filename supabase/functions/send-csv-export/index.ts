/**
 * send-csv-export
 *
 * Two callers:
 *   1. pg_cron (1st of every month) — body: {} — loops all users
 *   2. Settings page button — body: { userId, userEmail, userName, recipientEmail }
 *
 * Both send the same email:
 *   - Latest snapshot summary (net worth, invested, actual invested) "as of Month YYYY"
 *   - Full CSV backup attached
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  { table: 'goals',                        label: 'Goals' },
  { table: 'ideal_allocations',            label: 'Ideal Allocations' },
  { table: 'networth_snapshots',           label: 'Networth Snapshots' },
]

function fmtINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

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

async function processUser(
  supabase:       ReturnType<typeof createClient>,
  userId:         string,
  userEmail:      string,
  userName:       string,
  recipientEmail: string,
  exportDate:     string,
  fileName:       string,
): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')!
  const resendFrom   = Deno.env.get('RESEND_FROM')!

  // ── Fetch latest snapshot ────────────────────────────────────
  const { data: latestSnap } = await supabase
    .from('networth_snapshots')
    .select('month, net_worth, invested, actual_invested')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  const asOfLabel = latestSnap
    ? new Date(latestSnap.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()
    : null

  // ── Fetch all tables + build CSV ─────────────────────────────
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
  const csvBase64 = btoa(unescape(encodeURIComponent(csv)))

  // ── Build snapshot summary section ───────────────────────────
  const snapshotSection = latestSnap ? `
  <tr>
    <td style="background:#ffffff;padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0DDD6;border-radius:12px;overflow:hidden;">
        <tr>
          <td colspan="3" style="padding:12px 20px;background:#F5F4F0;border-bottom:1px solid #E0DDD6;">
            <table width="100%"><tr>
              <td style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">PORTFOLIO SUMMARY</td>
              <td align="right">
                <span style="background:#e0f2fe;color:#0369a1;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;">
                  AS OF ${asOfLabel}
                </span>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;border-right:1px solid #E0DDD6;text-align:center;">
            <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:4px;">NET WORTH</div>
            <div style="font-size:20px;font-weight:900;color:#0F766E;">${fmtINR(latestSnap.net_worth)}</div>
          </td>
          <td style="padding:16px 20px;border-right:1px solid #E0DDD6;text-align:center;">
            <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:4px;">INVESTED</div>
            <div style="font-size:20px;font-weight:900;color:#1A1A1A;">${fmtINR(latestSnap.invested)}</div>
          </td>
          <td style="padding:16px 20px;text-align:center;">
            <div style="font-size:11px;color:#999;letter-spacing:1px;margin-bottom:4px;">ACTUAL INV.</div>
            <div style="font-size:20px;font-weight:900;color:#D97706;">${latestSnap.actual_invested > 0 ? fmtINR(latestSnap.actual_invested) : '—'}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ''

  const statRows = tableStats
    .filter(t => t.rows > 0)
    .map(t => `
      <tr>
        <td style="padding:8px 16px;font-size:12px;color:#444;border-bottom:1px solid #f0ede8;">${t.label}</td>
        <td style="padding:8px 16px;font-size:12px;color:#0F766E;font-weight:700;text-align:right;border-bottom:1px solid #f0ede8;">${t.rows} rows</td>
      </tr>`).join('')

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
          <span style="background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 12px;font-size:11px;color:rgba(255,255,255,0.8);letter-spacing:1px;">MONTHLY REPORT</span>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:28px 32px 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">INFOLIO · ${exportDate}</p>
      <h1 style="margin:0;font-size:22px;font-weight:900;color:#1A1A1A;">Hi, ${userName} 👋</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#767676;line-height:1.6;">
        Your monthly INFolio report is ready. ${asOfLabel ? `Latest portfolio summary as of ${asOfLabel} is below.` : ''} Your full backup is attached.
      </p>
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
      subject:     `INFolio · Monthly Report — ${exportDate}`,
      html,
      attachments: csvBase64 ? [{ filename: fileName, content: csvBase64 }] : [],
    }),
  })

  const resendData = await resendRes.json()
  if (!resendRes.ok) throw new Error(resendData.message ?? 'Resend API error')
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase       = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => ({}))
    const now  = new Date()
    const exportDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const fileName   = `infolio-backup-${now.toISOString().slice(0, 10)}.csv`

    // ── Called from Settings page (single user) ───────────────
    if (body.userId) {
      const { userId, userEmail, userName, recipientEmail } = body
      if (!userId || !recipientEmail) {
        return new Response(JSON.stringify({ error: 'userId and recipientEmail are required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        })
      }
      await processUser(supabase, userId, userEmail, userName ?? userEmail, recipientEmail, exportDate, fileName)
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // ── Called from pg_cron (all users) ──────────────────────
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
    if (usersErr) throw new Error(`Failed to list users: ${usersErr.message}`)

    const results = []
    for (const user of users.users) {
      if (!user.email) continue
      try {
        await processUser(supabase, user.id, user.email,
          user.user_metadata?.full_name ?? user.email.split('@')[0] ?? 'there',
          user.email, exportDate, fileName)
        results.push({ userId: user.id, status: 'sent' })
        console.log(`[send-csv-export] ✅ Sent to ${user.email}`)
      } catch (err: any) {
        results.push({ userId: user.id, status: 'error', error: err.message })
        console.error(`[send-csv-export] ❌ ${user.email}:`, err.message)
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    return new Response(JSON.stringify({ sent, results }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (err: any) {
    console.error('[send-csv-export] Fatal:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
