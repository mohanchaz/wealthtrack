import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
]

// ── Build CSV ────────────────────────────────────────────────────────────────
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

// ── Build HTML email ─────────────────────────────────────────────────────────
function buildEmailHTML(
  userName: string,
  tableStats: { label: string; rows: number }[],
  exportDate: string,
  totalRows: number,
): string {
  const statRows = tableStats
    .filter(t => t.rows > 0)
    .map(t => `
      <tr>
        <td style="padding:8px 16px;font-size:12px;color:#444;border-bottom:1px solid #f0ede8;">${t.label}</td>
        <td style="padding:8px 16px;font-size:12px;color:#0F766E;font-weight:700;text-align:right;border-bottom:1px solid #f0ede8;">${t.rows} rows</td>
      </tr>`).join('')

  const emptyCount = tableStats.filter(t => t.rows === 0).length

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>INFolio Portfolio Backup</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:system-ui,-apple-system,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#0D4F4A 0%,#0F766E 55%,#14B8A6 100%);border-radius:16px 16px 0 0;padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <!-- Logo: rounded square icon -->
            <table cellpadding="0" cellspacing="0" style="display:inline-table;">
              <tr>
                <td style="background:rgba(255,255,255,0.15);border-radius:10px;width:42px;height:42px;text-align:center;vertical-align:middle;font-size:20px;font-weight:900;color:#99F6E4;letter-spacing:-1px;">C</td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">INFolio</span><span style="font-size:26px;font-weight:800;color:#2ECC71;margin-left:1px;">.</span>
                  <div style="font-size:8px;color:rgba(255,255,255,0.5);letter-spacing:3px;margin-top:2px;">PORTFOLIO INTELLIGENCE</div>
                </td>
              </tr>
            </table>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 12px;font-size:11px;color:rgba(255,255,255,0.8);letter-spacing:1px;">BACKUP</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="background:#ffffff;padding:28px 32px 0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">INFOLIO · ${exportDate}</p>
      <h1 style="margin:0;font-size:22px;font-weight:900;color:#1A1A1A;">Hi, ${userName} 👋</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#767676;">Your full portfolio backup is attached as a CSV file. You can use it to restore your data anytime from Settings → Import.</p>
    </td>
  </tr>

  <!-- Summary card -->
  <tr>
    <td style="background:#ffffff;padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid #E0DDD6;">
            <span style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">EXPORT SUMMARY</span>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 20px;border-right:1px solid #E0DDD6;text-align:center;">
                  <div style="font-size:24px;font-weight:900;color:#0F766E;">${totalRows}</div>
                  <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px;">TOTAL ROWS</div>
                </td>
                <td style="padding:14px 20px;border-right:1px solid #E0DDD6;text-align:center;">
                  <div style="font-size:24px;font-weight:900;color:#1A1A1A;">${tableStats.filter(t => t.rows > 0).length}</div>
                  <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px;">TABLES</div>
                </td>
                <td style="padding:14px 20px;text-align:center;">
                  <div style="font-size:24px;font-weight:900;color:#aaa;">${emptyCount}</div>
                  <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px;">EMPTY</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Table breakdown -->
  <tr>
    <td style="background:#ffffff;padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0DDD6;border-radius:12px;overflow:hidden;">
        <tr>
          <td colspan="2" style="padding:12px 16px;background:#F5F4F0;border-bottom:1px solid #E0DDD6;">
            <span style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;">BREAKDOWN</span>
          </td>
        </tr>
        ${statRows}
      </table>
    </td>
  </tr>

  <!-- Restore tip -->
  <tr>
    <td style="background:#ffffff;padding:0 32px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1A7A3C;">💡 To restore this backup</p>
            <p style="margin:0;font-size:12px;color:#444;line-height:1.5;">Open INFolio → Settings → <strong>Import &amp; restore</strong> → choose this CSV file. Your data will be fully restored.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:linear-gradient(135deg,#0D4F4A 0%,#0F766E 55%,#14B8A6 100%);border-radius:0 0 16px 16px;padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:rgba(255,255,255,0.6);">
            <strong style="color:rgba(255,255,255,0.9);">INFolio</strong> · Chaz Tech Ltd. · © 2026
          </td>
          <td align="right" style="font-size:11px;color:rgba(255,255,255,0.5);">
            🔒 Secure &amp; Private
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Edge Function handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }})
  }

  try {
    const { userId, userEmail, userName, recipientEmail } = await req.json()

    if (!userId || !recipientEmail) {
      return new Response(JSON.stringify({ error: 'userId and recipientEmail are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey    = Deno.env.get('RESEND_API_KEY')!
    const resendFrom      = Deno.env.get('RESEND_FROM')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Fetch all tables
    const tables: Record<string, Record<string, unknown>[]> = {}
    const tableStats: { label: string; rows: number }[] = []

    for (const def of TABLE_DEFS) {
      const { data, error } = await supabase
        .from(def.table).select('*').eq('user_id', userId)
      if (error) console.error(`Error fetching ${def.table}:`, error.message)
      const rows = (data ?? []) as Record<string, unknown>[]
      tables[def.table] = rows
      tableStats.push({ label: def.label, rows: rows.length })
    }

    const totalRows  = tableStats.reduce((s, t) => s + t.rows, 0)
    const csv        = buildCSV(tables)
    const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const fileName   = `infolio-backup-${new Date().toISOString().slice(0, 10)}.csv`
    const htmlBody   = buildEmailHTML(userName || userEmail || 'there', tableStats, exportDate, totalRows)

    // Base64 encode CSV for attachment
    const csvBase64 = btoa(unescape(encodeURIComponent(csv)))

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `INFolio <${resendFrom}>`,
        to:      [recipientEmail],
        subject: `INFolio · Portfolio Backup — ${exportDate}`,
        html:    htmlBody,
        attachments: [{
          filename: fileName,
          content:  csvBase64,
        }],
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) throw new Error(resendData.message ?? 'Resend API error')

    return new Response(JSON.stringify({ success: true, rows: totalRows, emailId: resendData.id }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (err: any) {
    console.error('send-csv-export error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
