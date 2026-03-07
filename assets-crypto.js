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
          onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.65" title="Edit">✏️</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.crypto-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.id) === String(btn.dataset.id));
      if (row) openCryptoEditModal(row);
    });
  });

  // Summary cards
  const hasPrices    = Object.keys(_cryptoLive).length > 0;
  const totalGainGBP = totalCurGBP - totalInvGBP;
  const gainPctStr   = totalInvGBP > 0 ? ` (${((totalGainGBP / totalInvGBP) * 100).toFixed(1)}%)` : '';
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('assets-total-invested', `£${totalInvGBP.toFixed(2)}`);
  setEl('assets-total-value',    hasPrices ? `£${totalCurGBP.toFixed(2)}` : '—');
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    if (!hasPrices) { gainEl.textContent = '—'; gainEl.style.color = 'var(--muted)'; }
    else {
      gainEl.textContent = `${totalGainGBP >= 0 ? '+' : ''}£${totalGainGBP.toFixed(2)}${gainPctStr}`;
      gainEl.style.color = totalGainGBP > 0 ? 'var(--green)' : totalGainGBP < 0 ? 'var(--danger)' : 'var(--muted)';
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

  const symbols = [...new Set(
    rows.map(r => r.yahoo_symbol).filter(Boolean).map(s => s.toUpperCase())
  )];
  if (!symbols.length) {
    if (lastUpd)    lastUpd.textContent = '⚠️ No Yahoo symbols set';
    if (refreshBtn) refreshBtn.disabled = false;
    return;
  }

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

  // API strips '-GBP' → key is 'BTC', 'ETH' etc.
  _cryptoLive = {};
  Object.entries(priceMap).forEach(([key, val]) => {
    _cryptoLive[key.toUpperCase()] = {
      price: typeof val === 'object' ? val.price : val,
      name:  typeof val === 'object' ? (val.name || null) : null,
    };
  });

  renderCryptoHoldings(rows);

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