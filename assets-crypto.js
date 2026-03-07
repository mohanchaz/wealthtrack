// ══════════════════════════════════════════════════════════════
//  CRYPTO — GBP only, manual entry, 2 platforms
//  Table: crypto_holdings
//  DB columns: id, user_id, yahoo_symbol, platform,
//              qty, avg_price_gbp, updated_at
//  Display name derived from yahoo_symbol: BTC-GBP → BTC
//  Live price fetched from Yahoo Finance
// ══════════════════════════════════════════════════════════════

// In-memory live prices: { [key]: { price, name } }
// key = yahoo_symbol with '-GBP' stripped, uppercased (e.g. 'BTC', 'ETH')
let _cryptoLive = {};
let _cryptoRows = [];
let _cryptoActualRows = [];
let _liveGbpInrRate = null;

// Strip '-GBP' suffix → display ticker (BTC-GBP → BTC)
function cryptoTicker(yahooSymbol) {
  return (yahooSymbol || '').toUpperCase().replace(/-GBP$/i, '');
}

// ── Render ────────────────────────────────────────────────────

function renderCryptoHoldings(rows) {
  const tbody = document.getElementById('assets-table-body');
  const thead = document.getElementById('assets-thead-row');
  if (!tbody) return;

  const thS = 'padding:5px 10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted2);border-bottom:1px solid var(--border);white-space:nowrap';
  const thR = thS + ';text-align:right';
  const thL = thS + ';text-align:left';

  if (thead) {
    thead.innerHTML = `
      <th class="bulk-check-cell" style="width:32px;padding:0 8px;display:none"></th>
      <th style="${thL}">Coin</th>
      <th style="${thL}">Platform</th>
      <th style="${thR}">Qty</th>
      <th style="${thR}">Avg (£)</th>
      <th style="${thR}">Price (£)</th>
      <th style="${thR}">Invested (£)</th>
      <th style="${thR}">Cur. Val (£)</th>
      <th style="${thR}">Gain (£)</th>
      <th style="${thR}">Alloc</th>
      <th></th>`;
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="padding:32px;text-align:center;color:var(--muted2)">
      No crypto holdings yet — click <b>+ Add Holding</b> to get started
    </td></tr>`;
    ['assets-total-invested','assets-total-value','assets-total-gain'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    return;
  }

  let totalInvGBP = 0, totalCurGBP = 0;
  rows.forEach(r => {
    const qty  = +r.qty || 0;
    const avg  = +r.avg_price_gbp || 0;
    const live = _cryptoLive[cryptoTicker(r.yahoo_symbol)];
    const cur  = live?.price ?? avg;
    totalInvGBP += qty * avg;
    totalCurGBP += qty * cur;
  });

  const td  = 'padding:8px 10px;border-bottom:1px solid var(--border);white-space:nowrap';
  const tdr = td + ';text-align:right;font-variant-numeric:tabular-nums';
  const dash = '<span style="color:var(--muted2)">—</span>';

  tbody.innerHTML = rows.map((r, i) => {
    const ticker = cryptoTicker(r.yahoo_symbol);
    const qty    = +r.qty || 0;
    const avg    = +r.avg_price_gbp || 0;
    const live   = _cryptoLive[ticker];
    const cur    = live?.price ?? null;
    const inv    = qty * avg;
    const curVal = cur != null ? qty * cur : null;
    const gain   = curVal != null ? curVal - inv : null;
    const gainPct = gain != null && inv > 0 ? ` (${((gain / inv) * 100).toFixed(1)}%)` : '';
    const alloc  = totalCurGBP > 0 && curVal != null ? (curVal / totalCurGBP) * 100 : null;
    const gc     = gain == null ? 'var(--muted2)' : gain > 0 ? 'var(--green)' : gain < 0 ? 'var(--danger)' : 'var(--muted)';

    const platformBadge = `<span style="background:${r.platform === 'Platform 1' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)'};color:${r.platform === 'Platform 1' ? '#6366f1' : '#ec4899'};padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600">${r.platform}</span>`;

    const allocBar = alloc != null
      ? `<span style="display:inline-flex;align-items:center;gap:5px;justify-content:flex-end">
          <span style="width:40px;height:4px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
            <span style="display:block;height:100%;width:${Math.min(alloc,100).toFixed(1)}%;background:var(--accent);border-radius:99px"></span>
          </span>
          <b style="font-size:11px;color:var(--accent)">${alloc.toFixed(1)}%</b>
        </span>`
      : dash;

    const gainStr = gain == null ? dash
      : `${gain >= 0 ? '+' : ''}£${gain.toFixed(2)}<span style="font-size:10px">${gainPct}</span>`;

    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td class="bulk-check-cell" style="width:32px;padding:0 8px;display:none">
        <input type="checkbox" class="asset-row-checkbox" data-id="${r.id}" data-table="crypto_holdings"
          style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)">
      </td>
      <td style="${td}">
        <div style="font-weight:700">${ticker}</div>
        <div style="font-size:10px;color:var(--muted2)">${r.yahoo_symbol}</div>
      </td>
      <td style="${td}">${platformBadge}</td>
      <td style="${tdr}">${qty.toLocaleString('en-GB', {maximumFractionDigits:8})}</td>
      <td style="${tdr}">£${avg.toLocaleString('en-GB', {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td style="${tdr};font-weight:600">${cur != null ? '£' + cur.toLocaleString('en-GB', {minimumFractionDigits:2,maximumFractionDigits:2}) : dash}</td>
      <td style="${tdr}">£${inv.toFixed(2)}</td>
      <td style="${tdr};font-weight:600">${curVal != null ? '£' + curVal.toFixed(2) : dash}</td>
      <td style="${tdr};font-weight:600;color:${gc}">${gainStr}</td>
      <td style="${tdr}">${allocBar}</td>
      <td style="${td};text-align:right">
        <button class="crypto-edit-btn" data-id="${r.id}"
          style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 3px;opacity:0.65;transition:opacity 0.15s"
          onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.65" title="Edit">🖊️</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.crypto-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.id) === String(btn.dataset.id));
      if (row) openCryptoEditModal(row);
    });
  });

  // Wire checkboxes for main table select mode
  tbody.querySelectorAll('.asset-row-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      if (typeof updateBulkBar === 'function') updateBulkBar();
    });
  });
  // If select mode is active, keep checkboxes visible after re-render
  if (document.getElementById('bulk-delete-bar') && !document.getElementById('bulk-delete-bar').classList.contains('hidden')) {
    tbody.querySelectorAll('.bulk-check-cell').forEach(c => c.style.display = '');
  }

  // Summary cards
  const hasPrices    = Object.keys(_cryptoLive).length > 0;
  const totalGainGBP = totalCurGBP - totalInvGBP;
  const gainPctStr   = totalInvGBP > 0 ? ` (${((totalGainGBP / totalInvGBP) * 100).toFixed(1)}%)` : '';
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('assets-total-invested', `£${totalInvGBP.toFixed(2)}`);
  setEl('assets-total-value',    hasPrices ? `£${totalCurGBP.toFixed(2)}` : '—');
  // Also populate crypto-gbp-row tiles
  setEl('crypto-total-inv-gbp', `£${totalInvGBP.toFixed(2)}`);
  setEl('crypto-total-val-gbp', hasPrices ? `£${totalCurGBP.toFixed(2)}` : '—');
  const gainEl = document.getElementById('assets-total-gain');
  const gainEl2 = document.getElementById('crypto-total-gain-gbp');
  if (gainEl) {
    if (!hasPrices) { gainEl.textContent = '—'; gainEl.style.color = 'var(--muted)'; }
    else {
      gainEl.textContent = `${totalGainGBP >= 0 ? '+' : ''}£${totalGainGBP.toFixed(2)}${gainPctStr}`;
      gainEl.style.color = totalGainGBP > 0 ? 'var(--green)' : totalGainGBP < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  }
  if (gainEl2) {
    if (!hasPrices) { gainEl2.textContent = '—'; gainEl2.style.color = 'var(--muted)'; }
    else {
      gainEl2.textContent = `${totalGainGBP >= 0 ? '+' : ''}£${totalGainGBP.toFixed(2)}${gainPctStr}`;
      gainEl2.style.color = totalGainGBP > 0 ? 'var(--green)' : totalGainGBP < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  }
  const countEl = document.getElementById('assets-count-inline');
  if (countEl) countEl.textContent = rows.length + ' holding' + (rows.length !== 1 ? 's' : '');
}

// ── Live price fetch ──────────────────────────────────────────

async function fetchAndRefreshCryptoPrices(rows) {
  const lastUpd    = document.getElementById('crypto-last-updated');
  const refreshBtn = document.getElementById('crypto-refresh-btn');
  if (lastUpd)    lastUpd.textContent = '🔄 Fetching prices…';
  if (refreshBtn) refreshBtn.disabled = true;

  const cryptoSymbols = [...new Set(
    rows.map(r => r.yahoo_symbol).filter(Boolean).map(s => s.toUpperCase())
  )];
  if (!cryptoSymbols.length) {
    if (lastUpd)    lastUpd.textContent = '⚠️ No Yahoo symbols set';
    if (refreshBtn) refreshBtn.disabled = false;
    return;
  }
  // Include FX symbols for INR conversion
  const symbols = [...cryptoSymbols, 'GBPUSD=X', 'USDINR=X'];

  let priceMap = null;
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    priceMap = await res.json();
    if (priceMap.error) throw new Error(priceMap.error);
  } catch (err) {
    console.warn('[CryptoPrices] fetch failed:', err.message);
    if (lastUpd)    lastUpd.textContent = '⚠️ Price fetch failed';
    if (refreshBtn) refreshBtn.disabled = false;
    showToast('Live price fetch failed', 'error');
    return;
  }

  if (refreshBtn) refreshBtn.disabled = false;

  // Extract live GBP→INR rate
  const gbpUsd = priceMap['GBPUSD=X']?.price ?? priceMap['GBPUSD=X'] ?? null;
  const usdInr = priceMap['USDINR=X']?.price ?? priceMap['USDINR=X'] ?? null;
  if (gbpUsd && usdInr) _liveGbpInrRate = gbpUsd * usdInr;

  // API strips '-GBP' → key is 'BTC', 'ETH' etc.
  _cryptoLive = {};
  Object.entries(priceMap).forEach(([key, val]) => {
    if (key === 'GBPUSD=X' || key === 'USDINR=X') return;
    _cryptoLive[key.toUpperCase()] = {
      price: typeof val === 'object' ? val.price : val,
      name:  typeof val === 'object' ? (val.name || null) : null,
    };
  });

  renderCryptoHoldings(rows);
  _refreshCryptoActualGainTile();

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpd) lastUpd.textContent = `🟢 Live · ${now}`;
}

// ── Load ──────────────────────────────────────────────────────

async function loadCryptoHoldings(userId) {
  const tbody = document.getElementById('assets-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="padding:32px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('crypto_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('yahoo_symbol');

  if (error) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="padding:32px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  _cryptoRows = data || [];
  renderCryptoHoldings(_cryptoRows);
  if (_cryptoRows.length) fetchAndRefreshCryptoPrices(_cryptoRows);
}

// ── Add Modal ─────────────────────────────────────────────────

function openCryptoImportModal() {
  ['crypto-import-symbol','crypto-import-qty','crypto-import-avg-price']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('crypto-import-modal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCryptoImportModal() {
  document.getElementById('crypto-import-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Edit Modal ────────────────────────────────────────────────

let _editingCryptoId = null;

function openCryptoEditModal(row) {
  _editingCryptoId = row.id;
  const ticker = cryptoTicker(row.yahoo_symbol);
  document.getElementById('crypto-edit-title').textContent = `Edit — ${ticker}`;
  document.getElementById('crypto-edit-symbol').value    = row.yahoo_symbol   || '';
  document.getElementById('crypto-edit-platform').value  = row.platform       || 'Platform 1';
  document.getElementById('crypto-edit-qty').value       = row.qty            || '';
  document.getElementById('crypto-edit-avg-price').value = row.avg_price_gbp  || '';
  document.getElementById('crypto-edit-modal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCryptoEditModal() {
  document.getElementById('crypto-edit-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
  _editingCryptoId = null;
}

// ── Event wiring ──────────────────────────────────────────────

document.addEventListener('fragments-loaded', () => {

  document.getElementById('crypto-refresh-btn')?.addEventListener('click', () => {
    if (_cryptoRows.length) fetchAndRefreshCryptoPrices(_cryptoRows);
  });

  // Add modal
  const addModal = document.getElementById('crypto-import-modal');
  document.getElementById('crypto-import-btn')?.addEventListener('click', openCryptoImportModal);
  document.getElementById('crypto-import-close-btn')?.addEventListener('click',  closeCryptoImportModal);
  document.getElementById('crypto-import-cancel-btn')?.addEventListener('click', closeCryptoImportModal);
  addModal?.addEventListener('click', e => { if (e.target === addModal) closeCryptoImportModal(); });

  document.getElementById('crypto-import-save-btn')?.addEventListener('click', async () => {
    const yahooSym = document.getElementById('crypto-import-symbol').value.trim().toUpperCase();
    const platform = document.getElementById('crypto-import-platform').value;
    const qty      = parseFloat(document.getElementById('crypto-import-qty').value);
    const avgPrice = parseFloat(document.getElementById('crypto-import-avg-price').value);

    if (!yahooSym)          { showToast('Yahoo symbol is required (e.g. BTC-GBP)', 'error'); return; }
    if (!qty || qty <= 0)   { showToast('Quantity must be > 0', 'error'); return; }
    if (!avgPrice || avgPrice <= 0) { showToast('Avg price must be > 0', 'error'); return; }

    const saveBtn = document.getElementById('crypto-import-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const { error } = await sb.from('crypto_holdings').insert({
      user_id: _currentUserId, yahoo_symbol: yahooSym,
      platform, qty, avg_price_gbp: avgPrice,
      updated_at: new Date().toISOString(),
    });

    saveBtn.textContent = '+ Add Asset'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast('Holding added ✅', 'success'); closeCryptoImportModal(); loadCryptoHoldings(_currentUserId); }
  });

  // Edit modal
  const editModal = document.getElementById('crypto-edit-modal');
  document.getElementById('crypto-edit-close-btn')?.addEventListener('click',  closeCryptoEditModal);
  document.getElementById('crypto-edit-cancel-btn')?.addEventListener('click', closeCryptoEditModal);
  editModal?.addEventListener('click', e => { if (e.target === editModal) closeCryptoEditModal(); });

  document.getElementById('crypto-edit-save-btn')?.addEventListener('click', async () => {
    if (!_editingCryptoId) return;
    const yahooSym = document.getElementById('crypto-edit-symbol').value.trim().toUpperCase();
    const platform = document.getElementById('crypto-edit-platform').value;
    const qty      = parseFloat(document.getElementById('crypto-edit-qty').value);
    const avgPrice = parseFloat(document.getElementById('crypto-edit-avg-price').value);

    if (!yahooSym)        { showToast('Yahoo symbol is required (e.g. BTC-GBP)', 'error'); return; }
    if (!qty || qty <= 0) { showToast('Quantity must be > 0', 'error'); return; }
    if (!avgPrice || avgPrice <= 0) { showToast('Avg price must be > 0', 'error'); return; }

    const saveBtn = document.getElementById('crypto-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const { error } = await sb.from('crypto_holdings').update({
      yahoo_symbol: yahooSym, platform, qty,
      avg_price_gbp: avgPrice, updated_at: new Date().toISOString(),
    }).eq('id', _editingCryptoId);

    saveBtn.textContent = '💾 Save'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast('Updated ✅', 'success'); closeCryptoEditModal(); loadCryptoHoldings(_currentUserId); }
  });

});

// ══════════════════════════════════════════════════════════════
//  CRYPTO — Actual Invested
//  Table: crypto_actual_invested
//  Columns: id, user_id, entry_date, gbp_amount, inr_rate
// ══════════════════════════════════════════════════════════════

let _editingCaiId = null;

// ── Refresh actual gain tile ──────────────────────────────────
function _refreshCryptoActualGainTile() {
  // Re-render actual invested tiles now that live prices are available
  // renderCryptoActualInvested uses totalInvGBP (not actGBP) as the gain base,
  // and _liveGbpInrRate for INR current value
  if (typeof _cryptoActualRows !== 'undefined' && _cryptoActualRows.length) {
    renderCryptoActualInvested(_cryptoActualRows);
  }
}

// ── Load ──────────────────────────────────────────────────────
async function loadCryptoActualInvested(userId) {
  const section = document.getElementById('crypto-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('crypto-monthly-body');
  if (body) body.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>';

  const { data, error } = await sb
    .from('crypto_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">' + error.message + '</td></tr>';
    return;
  }
  _cryptoActualRows = data || [];
  renderCryptoActualInvested(_cryptoActualRows);
}

// ── Render ────────────────────────────────────────────────────
function renderCryptoActualInvested(rows) {
  const body    = document.getElementById('crypto-monthly-body');
  const totalEl = document.getElementById('crypto-monthly-total');
  if (!body) return;

  const totalGBP = rows.reduce((s, r) => s + (+r.gbp_amount || 0), 0);
  const totalINR = rows.reduce((s, r) => s + ((+r.gbp_amount || 0) * (+r.inr_rate || 0)), 0);
  if (totalEl) totalEl.textContent = '£' + totalGBP.toFixed(2) + (totalINR > 0 ? '  ·  ' + INR(totalINR) : '');

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setElColor = (id, v, c) => { const el = document.getElementById(id); if (el) { el.textContent = v; el.style.color = c; } };

  // Weighted avg GBP→INR rate across all entries
  const weightedInrRate = totalGBP > 0 ? totalINR / totalGBP : 0;

  // ── GBP tiles ──
  setEl('crypto-actual-inv-gbp', totalGBP > 0 ? '£' + totalGBP.toFixed(2) : '—');
  const curValEl = document.getElementById('crypto-total-val-gbp');
  const curGBP = curValEl ? parseFloat(curValEl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  if (totalGBP > 0 && curGBP > 0) {
    const gain = curGBP - totalGBP;
    const pct = ` (${((gain / totalGBP) * 100).toFixed(1)}%)`;
    setElColor('crypto-actual-gain-gbp',
      (gain >= 0 ? '+' : '') + '£' + Math.abs(gain).toFixed(2) + pct,
      gain > 0 ? 'var(--green)' : gain < 0 ? 'var(--danger)' : 'var(--muted)');
  } else {
    setEl('crypto-actual-gain-gbp', '—');
  }

  // ── INR row tiles ──
  // Use live GBP→INR rate for current value; historical weighted rate for invested
  // _liveGbpInrRate is set by fetchAndRefreshCryptoPrices via GBPUSD=X × USDINR=X
  const liveRate = _liveGbpInrRate || weightedInrRate;  // fallback to historical if live unavailable

  // Total Invested (₹) = totalInvGBP (all holdings) × historical weighted rate (cost basis)
  // Actual Invested (₹) = actual cash put in = sum of gbp_amount × inr_rate per entry
  const totalInvINR = totalGBP > 0 ? totalGBP * weightedInrRate : 0;

  if (totalInvINR > 0 || totalINR > 0) {
    setEl('crypto-total-inv-inr', INR(totalInvINR || totalINR));
    setEl('crypto-actual-inv-inr', INR(totalINR));  // actual cash invested in INR

    // Current Value INR = current GBP value × live rate
    const curINR = curGBP > 0 ? curGBP * liveRate : 0;
    setEl('crypto-total-val-inr', curINR > 0 ? INR(curINR) : '—');

    // Total Gain INR (base = total invested INR)
    if (curINR > 0) {
      const baseINR = totalInvINR || totalINR;
      const gainINR = curINR - baseINR;
      const pctINR = baseINR > 0 ? ` (${((gainINR / baseINR) * 100).toFixed(1)}%)` : '';
      setElColor('crypto-total-gain-inr',
        (gainINR >= 0 ? '+' : '') + INR(Math.abs(gainINR)) + pctINR,
        gainINR > 0 ? 'var(--green)' : gainINR < 0 ? 'var(--danger)' : 'var(--muted)');

      // Actual Gain INR (base = actual cash invested in INR)
      const actGainINR = curINR - totalINR;
      const actPctINR = totalINR > 0 ? ` (${((actGainINR / totalINR) * 100).toFixed(1)}%)` : '';
      setElColor('crypto-actual-gain-inr',
        (actGainINR >= 0 ? '+' : '') + INR(Math.abs(actGainINR)) + actPctINR,
        actGainINR > 0 ? 'var(--green)' : actGainINR < 0 ? 'var(--danger)' : 'var(--muted)');
    } else {
      setEl('crypto-total-gain-inr', '—');
      setEl('crypto-actual-gain-inr', '—');
    }
  } else {
    ['crypto-total-inv-inr','crypto-total-val-inr','crypto-total-gain-inr',
     'crypto-actual-inv-inr','crypto-actual-gain-inr'].forEach(id => setEl(id, '—'));
  }

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="4" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add</b></td></tr>';
    return;
  }

  const thS = 'padding:9px 14px;border-bottom:1px solid var(--border)';
  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const inrAmt  = (+r.gbp_amount || 0) * (+r.inr_rate || 0);
    return '<tr style="background:' + (i % 2 === 0 ? '#fff' : 'var(--surface2)') + '">' +
      '<td class="cai-cb-wrap" data-id="' + r.id + '" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="cai-cb" data-id="' + r.id + '" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>' +
      '<td style="' + thS + ';color:var(--accent);font-weight:500">' + dateStr + '</td>' +
      '<td style="' + thS + ';text-align:right;font-weight:600">£' + (+r.gbp_amount).toFixed(2) + '</td>' +
      '<td style="' + thS + ';text-align:right;color:var(--muted2)">' + (inrAmt > 0 ? INR(inrAmt) : '—') + '</td>' +
      '<td style="' + thS + ';white-space:nowrap">' +
        '<button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" ' +
          'data-id="' + r.id + '" data-date="' + r.entry_date + '" data-gbp="' + r.gbp_amount + '" data-rate="' + (r.inr_rate || '') + '" ' +
          'class="cai-edit-btn" title="Edit">🖊️</button>' +
      '</td>' +
    '</tr>';
  }).join('') +
    '<tr style="background:var(--surface2)">' +
    '<td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>' +
    '<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">£' + totalGBP.toFixed(2) + '</td>' +
    '<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">' + (totalINR > 0 ? INR(totalINR) : '—') + '</td>' +
    '<td></td></tr>';

  body.querySelectorAll('.cai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openCaiModal({
      id: btn.dataset.id, entry_date: btn.dataset.date,
      gbp_amount: btn.dataset.gbp, inr_rate: btn.dataset.rate
    }));
  });
}

// ── Add / Edit modal ──────────────────────────────────────────
function openCaiModal(row = null) {
  _editingCaiId = row?.id || null;
  const titleEl = document.getElementById('crypto-invested-modal-title');
  const saveBtn = document.getElementById('crypto-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '💾 Save Entry';

  document.getElementById('cai-date').value     = row?.entry_date || '';
  document.getElementById('cai-gbp').value      = row?.gbp_amount || '';
  document.getElementById('cai-inr-rate').value = row?.inr_rate   || '';
  _updateCaiPreview();

  document.getElementById('crypto-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCaiModal() {
  document.getElementById('crypto-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingCaiId = null;
}

function _updateCaiPreview() {
  const gbp  = parseFloat(document.getElementById('cai-gbp')?.value)      || 0;
  const rate = parseFloat(document.getElementById('cai-inr-rate')?.value)  || 0;
  const preview    = document.getElementById('cai-inr-preview');
  const previewVal = document.getElementById('cai-inr-preview-val');
  if (!preview || !previewVal) return;
  if (gbp > 0 && rate > 0) {
    preview.style.display = '';
    previewVal.textContent = INR(gbp * rate);
  } else {
    preview.style.display = 'none';
  }
}

// ── Fragment-loaded wiring ────────────────────────────────────
document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('crypto-invested-modal');
  if (!modal) return;

  document.getElementById('crypto-invested-add-btn')?.addEventListener('click',    () => openCaiModal());
  document.getElementById('crypto-invested-close-btn')?.addEventListener('click',  closeCaiModal);
  document.getElementById('crypto-invested-cancel-btn')?.addEventListener('click', closeCaiModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeCaiModal(); });

  document.getElementById('cai-gbp')?.addEventListener('input',      _updateCaiPreview);
  document.getElementById('cai-inr-rate')?.addEventListener('input', _updateCaiPreview);

  document.getElementById('crypto-invested-save-btn')?.addEventListener('click', async () => {
    const date    = document.getElementById('cai-date').value;
    const gbp     = parseFloat(document.getElementById('cai-gbp').value);
    const inrRate = parseFloat(document.getElementById('cai-inr-rate').value) || null;

    if (!date)               { showToast('Date is required',       'error'); return; }
    if (!gbp || gbp <= 0)    { showToast('GBP amount must be > 0', 'error'); return; }

    const saveBtn = document.getElementById('crypto-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, gbp_amount: gbp, inr_rate: inrRate };
    let op;
    if (_editingCaiId) {
      op = sb.from('crypto_actual_invested').update(payload).eq('id', _editingCaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('crypto_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingCaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeCaiModal();
      loadCryptoActualInvested(_currentUserId);
    }
  });
});

// ── Bulk select / delete ──────────────────────────────────────
(function () {
  var _sel = false;
  var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function _enter() {
    _sel = true;
    var btn = document.getElementById('crypto-select-btn');
    if (btn) { btn.innerHTML = '✕ Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
    document.getElementById('crypto-bulk-bar')?.classList.remove('hidden');
    document.querySelectorAll('.cai-cb-wrap').forEach(c => { c.style.display = ''; });
    _upd();
  }

  function _exit() {
    _sel = false;
    var btn = document.getElementById('crypto-select-btn');
    if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
    document.getElementById('crypto-bulk-bar')?.classList.add('hidden');
    document.getElementById('crypto-bulk-normal').style.display = 'flex';
    document.getElementById('crypto-bulk-confirm').style.display = 'none';
    document.querySelectorAll('.cai-cb-wrap').forEach(c => { c.style.display = 'none'; });
    document.querySelectorAll('.cai-cb').forEach(c => { c.checked = false; });
    var sa = document.getElementById('crypto-select-all');
    if (sa) { sa.checked = false; sa.indeterminate = false; }
    _upd();
  }

  function _upd() {
    var all     = document.querySelectorAll('.cai-cb');
    var checked = document.querySelectorAll('.cai-cb:checked');
    var n = checked.length;
    var countEl = document.getElementById('crypto-bulk-count');
    var delBtn  = document.getElementById('crypto-bulk-delete');
    if (countEl) countEl.textContent = n + ' selected';
    if (delBtn)  delBtn.disabled = n === 0;
    var sa = document.getElementById('crypto-select-all');
    if (sa) {
      sa.indeterminate = n > 0 && n < all.length;
      sa.checked = all.length > 0 && n === all.length;
    }
  }

  document.addEventListener('fragments-loaded', function () {
    document.getElementById('crypto-select-btn')?.addEventListener('click', function () {
      if (_sel) _exit(); else _enter();
    });
    document.getElementById('crypto-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('crypto-select-all')?.addEventListener('change', function () {
      var toCheck = this.checked;
      document.querySelectorAll('.cai-cb').forEach(cb => { cb.checked = toCheck; });
      _upd();
    });

    document.getElementById('crypto-bulk-delete')?.addEventListener('click', function () {
      var n = document.querySelectorAll('.cai-cb:checked').length;
      if (!n) return;
      document.getElementById('crypto-bulk-normal').style.display = 'none';
      document.getElementById('crypto-bulk-confirm').style.display = 'flex';
      document.getElementById('crypto-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('crypto-bulk-no')?.addEventListener('click', function () {
      document.getElementById('crypto-bulk-normal').style.display = 'flex';
      document.getElementById('crypto-bulk-confirm').style.display = 'none';
    });

    document.getElementById('crypto-bulk-yes')?.addEventListener('click', async function () {
      var ids = Array.from(document.querySelectorAll('.cai-cb:checked')).map(c => c.dataset.id);
      if (!ids.length) return;
      var btn = document.getElementById('crypto-bulk-yes');
      btn.textContent = 'Deleting…'; btn.disabled = true;
      var { error } = await sb.from('crypto_actual_invested').delete().in('id', ids);
      btn.textContent = 'Yes, delete'; btn.disabled = false;
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
      showToast(ids.length + ' entr' + (ids.length === 1 ? 'y' : 'ies') + ' deleted', 'success');
      _exit();
      loadCryptoActualInvested(_currentUserId);
    });

    document.getElementById('crypto-monthly-body')?.addEventListener('change', function (e) {
      if (e.target.classList.contains('cai-cb')) _upd();
    });
  });
})();