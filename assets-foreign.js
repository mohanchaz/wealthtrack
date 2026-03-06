// ══════════════════════════════════════════════════════════════
//  FOREIGN STOCKS  — foreign_stock_holdings
//  DB stores: symbol, qty, avg_price, currency
//  Unit price & current value are parsed from CSV into memory
//  and never written to the DB.
// ══════════════════════════════════════════════════════════════

// GBX symbols: only explicitly listed symbols — .L suffix alone does NOT mean GBX
const GBX_HARDCODED = new Set(['MKS']);
const isLondonSymbol = sym => typeof sym === 'string' && GBX_HARDCODED.has(sym.toUpperCase().replace(/\.L$/i, ''));

// Maps DB symbol → correct Yahoo Finance ticker
// Add entries here whenever a symbol differs from what Yahoo expects
const YAHOO_SYMBOL_MAP = {
  'BRK': 'BRK-B',   // DB stores 'BRK', Yahoo needs 'BRK-B'
  'CNDX': 'CNDX.L',  // London ETF
  'IGLN': 'IGLN.L',  // London ETF
  'MKS': 'MKS.L',   // London stock (GBX)
  'SPXS': 'SPXS.L',  // London ETF
};
// Reverse: Yahoo key (after .L strip) → DB symbol
const YAHOO_KEY_TO_DB = {};
Object.entries(YAHOO_SYMBOL_MAP).forEach(([db, yahoo]) => {
  YAHOO_KEY_TO_DB[yahoo.replace(/\.L$/i, '').replace(/-B$/i, '')] = db;  // CNDX→CNDX, BRK-B→BRK... wait
});
// Simpler reverse: strip .L from yahoo ticker to get key, map that back to DB symbol
const YAHOO_TICKER_TO_DB = {};
Object.entries(YAHOO_SYMBOL_MAP).forEach(([db, yahoo]) => {
  const key = yahoo.replace(/\.L$/i, '');  // BRK-B, CNDX, IGLN, MKS, SPXS
  YAHOO_TICKER_TO_DB[key] = db;
});

// In-memory map: symbol → { unitPrice (native), currentValue (native), name }
// Populated at import time, lives until page refresh.
let _foreignLiveData = {};

// Live GBP/USD rate (1 GBP = x USD). null = not yet fetched.
let _gbpUsdRate = null;
// Live USD/INR rate (1 USD = x INR). null = not yet fetched.
let _usdInrRate = null;

// Convert a USD amount to GBP; returns null if rate unavailable
const toGBP = (usd) => _gbpUsdRate ? usd / _gbpUsdRate : null;
// Convert a USD amount to INR; returns null if rate unavailable
const toINR = (usd) => _usdInrRate ? usd * _usdInrRate : null;
// GBX (pence) → GBP
const gbxToGBP = (gbx) => gbx / 100;

// ── Render table ──────────────────────────────────────────────

function renderForeignStocks(rows) {
  const tbody = document.getElementById('assets-table-body');
  const thead = document.getElementById('assets-thead-row');
  if (!tbody) return;

  const thS = 'padding:5px 6px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted2);border-bottom:1px solid var(--border);white-space:nowrap';
  const thL = thS.replace('text-align:right','text-align:left');

  if (thead) {
    thead.innerHTML = `
      <th style="${thL}">Symbol</th>
      <th style="${thL}">Name</th>
      <th style="${thS}">Qty</th>
      <th style="${thS}">Avg</th>
      <th style="${thS}">Price</th>
      <th style="${thS.replace('text-align:right','text-align:center')}">CCY</th>
      <th style="${thS}">Invested</th>
      <th style="${thS}">Cur. Val</th>
      <th style="${thS}">Gain/Loss</th>
      <th style="${thS}">Inv (£)</th>
      <th style="${thS}">Val (£)</th>
      <th style="${thS}">G/L (£)</th>
      <th></th>`;
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="13" style="padding:32px;text-align:center;color:var(--muted2)">
      No foreign holdings yet — click <b>📥 Import CSV</b> to add
    </td></tr>`;
    ['assets-total-invested', 'assets-total-value', 'assets-total-gain'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    return;
  }

  let totalInvUSD = 0, totalInvGBP = 0;
  let totalCurUSD = 0, totalCurGBP = 0;

  tbody.innerHTML = rows.map((r, i) => {
    const isGBX = isLondonSymbol(r.symbol) || r.currency === 'GBX';
    const factor = isGBX ? 100 : 1;
    const ccy = isGBX ? 'GBP' : 'USD';
    const sym = isGBX ? '£' : '$';

    const avgDisp = r.avg_price / factor;
    const live = _foreignLiveData[r.symbol];
    const unitDisp = live?.unitPrice != null ? live.unitPrice / factor : null;
    const curDisp = live?.currentValue != null ? live.currentValue / factor : null;
    const invested = r.qty * avgDisp;
    const curVal = curDisp ?? (unitDisp != null ? r.qty * unitDisp : null);

    if (isGBX) { totalInvGBP += invested; if (curVal != null) totalCurGBP += curVal; }
    else { totalInvUSD += invested; if (curVal != null) totalCurUSD += curVal; }

    const gain = curVal != null ? curVal - invested : null;
    const gainPct = gain != null && invested ? ` (${((gain / invested) * 100).toFixed(1)}%)` : '';
    const gainColor = gain == null ? 'var(--muted2)' : gain > 0 ? 'var(--green)' : gain < 0 ? 'var(--danger)' : 'var(--muted)';
    const gainStr = gain == null ? '<span style="color:var(--muted2)">—</span>'
      : `${gain >= 0 ? '+' : ''}${sym}${gain.toFixed(2)}<span style="font-size:10px">${gainPct}</span>`;

    // GBP equivalents
    const invGBP  = isGBX ? invested : toGBP(invested);
    const curGBP  = curVal != null ? (isGBX ? curVal : toGBP(curVal)) : null;
    const gainGBP = invGBP != null && curGBP != null ? curGBP - invGBP : null;
    const gainGBPPct = gainGBP != null && invGBP ? ` (${((gainGBP / invGBP) * 100).toFixed(1)}%)` : '';
    const gainGBPColor = gainGBP == null ? 'var(--muted2)' : gainGBP > 0 ? 'var(--green)' : gainGBP < 0 ? 'var(--danger)' : 'var(--muted)';
    const gainGBPStr = gainGBP == null ? '<span style="color:var(--muted2)">—</span>'
      : `${gainGBP >= 0 ? '+' : ''}£${Math.abs(gainGBP).toFixed(2)}<span style="font-size:10px">${gainGBPPct}</span>`;

    const badge = `<span style="background:${isGBX ? '#e8f4fd' : '#e8fdf0'};color:${isGBX ? '#1a6fa8' : '#15803d'};padding:1px 5px;border-radius:20px;font-size:10px;font-weight:600">${ccy}</span>`;
    const td  = 'padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap';
    const tdr = td + ';text-align:right;font-variant-numeric:tabular-nums';
    const dash = '<span style="color:var(--muted2)">—</span>';
    const stockName = live?.name || '—';

    return `<tr data-id="${r.id}" style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td style="${td};font-weight:700">${r.symbol}</td>
      <td style="${td};color:var(--muted2);font-size:11px;max-width:90px;overflow:hidden;text-overflow:ellipsis" title="${live?.name || ''}">${stockName}</td>
      <td style="${tdr}">${(+r.qty).toFixed(4)}</td>
      <td style="${tdr}">${avgDisp.toFixed(2)}</td>
      <td style="${tdr}">${unitDisp != null ? unitDisp.toFixed(2) : dash}</td>
      <td style="${td};text-align:center">${badge}</td>
      <td style="${tdr}">${sym}${invested.toFixed(2)}</td>
      <td style="${tdr};font-weight:600">${curVal != null ? `${sym}${curVal.toFixed(2)}` : dash}</td>
      <td style="${tdr};font-weight:600;color:${gainColor}">${gainStr}</td>
      <td style="${tdr}">${invGBP != null ? '£' + invGBP.toFixed(2) : dash}</td>
      <td style="${tdr};font-weight:600">${curGBP != null ? '£' + curGBP.toFixed(2) : dash}</td>
      <td style="${tdr};font-weight:600;color:${gainGBPColor}">${gainGBPStr}</td>
      <td style="${td};text-align:right">
        <button class="foreign-edit-btn" data-id="${r.id}"
          style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 3px;opacity:0.65;transition:opacity 0.15s"
          onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.65" title="Edit">✏️</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.foreign-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => r.id === btn.dataset.id);
      if (row) openForeignEditModal(row);
    });
  });

  // Summary stats — convert USD totals to GBP if rate available
  const totalInvGBPAll = totalInvGBP + (_gbpUsdRate ? totalInvUSD / _gbpUsdRate : 0);
  const totalCurGBPAll = totalCurGBP + (_gbpUsdRate ? totalCurUSD / _gbpUsdRate : 0);
  const fmt = (usd, gbp) => {
    const p = [];
    if (usd) p.push(`$${usd.toFixed(2)}`);
    if (gbp) p.push(`£${gbp.toFixed(2)}`);
    return p.join('  +  ') || '—';
  };
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('assets-total-invested', fmt(totalInvUSD, totalInvGBP));
  setEl('assets-total-value', fmt(totalCurUSD || totalInvUSD, totalCurGBP || totalInvGBP));

  const gainUSD = totalCurUSD - totalInvUSD;
  const gainGBP = totalCurGBP - totalInvGBP;
  const gainParts = [];
  if (totalInvUSD) gainParts.push(`${gainUSD >= 0 ? '+' : ''}$${gainUSD.toFixed(2)}`);
  if (totalInvGBP) gainParts.push(`${gainGBP >= 0 ? '+' : ''}£${gainGBP.toFixed(2)}`);
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = gainParts.join('  +  ') || '—';
    gainEl.style.color = (gainUSD + gainGBP) > 0 ? 'var(--green)' : (gainUSD + gainGBP) < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  // ── INR summary row (top row — all amounts converted to ₹) ──
  // USD→INR: direct rate. GBP→INR: GBP * GBP/USD * USD/INR
  const gbpInrRate = (_gbpUsdRate && _usdInrRate) ? _gbpUsdRate * _usdInrRate : null;
  const totalInvINR = _usdInrRate
    ? (totalInvUSD * _usdInrRate) + (gbpInrRate ? totalInvGBP * gbpInrRate : 0)
    : null;
  const totalCurINR = _usdInrRate
    ? ((totalCurUSD || totalInvUSD) * _usdInrRate) + (gbpInrRate ? (totalCurGBP || totalInvGBP) * gbpInrRate : 0)
    : null;
  const gainINR = (totalInvINR != null && totalCurINR != null) ? totalCurINR - totalInvINR : null;
  const gainINRPct = (gainINR != null && totalInvINR) ? ` (${((gainINR / totalInvINR) * 100).toFixed(1)}%)` : '';
  const INRfmt = v => '₹' + v.toFixed(2);
  setEl('foreign-total-inv-inr', totalInvINR != null ? INRfmt(totalInvINR) : '—');
  setEl('foreign-total-val-inr', totalCurINR != null ? INRfmt(totalCurINR) : '—');
  const gainINREl = document.getElementById('foreign-total-gain-inr');
  if (gainINREl) {
    gainINREl.textContent = gainINR != null
      ? `${gainINR >= 0 ? '+' : ''}${INRfmt(gainINR)}${gainINRPct}`
      : '—';
    gainINREl.style.color = gainINR == null ? 'var(--muted2)'
      : gainINR > 0 ? 'var(--green)' : gainINR < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  // ── GBP summary row (second row — all amounts converted to £) ──
  const gainGBPAll = totalCurGBPAll - totalInvGBPAll;
  const gainGBPAllPct = totalInvGBPAll > 0 ? ` (${((gainGBPAll / totalInvGBPAll) * 100).toFixed(1)}%)` : '';
  setEl('foreign-total-inv-gbp', _gbpUsdRate ? `£${totalInvGBPAll.toFixed(2)}` : '—');
  setEl('foreign-total-val-gbp', _gbpUsdRate ? `£${totalCurGBPAll.toFixed(2)}` : '—');
  const gainGBPAllEl = document.getElementById('foreign-total-gain-gbp');
  if (gainGBPAllEl) {
    gainGBPAllEl.textContent = _gbpUsdRate
      ? `${gainGBPAll >= 0 ? '+' : ''}£${gainGBPAll.toFixed(2)}${gainGBPAllPct}`
      : '—';
    gainGBPAllEl.style.color = !_gbpUsdRate ? 'var(--muted2)'
      : gainGBPAll > 0 ? 'var(--green)' : gainGBPAll < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  // Refresh actual gain tiles now that live values are updated
  _refreshForeignActualGainTiles();

  const countEl = document.getElementById('assets-count-inline');
  if (countEl) countEl.textContent = `${rows.length} holding${rows.length !== 1 ? 's' : ''}`;
}

// ── Load ──────────────────────────────────────────────────────

async function loadForeignStocks(userId) {
  const tbody = document.getElementById('assets-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="padding:24px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('foreign_stock_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('symbol', { ascending: true });

  if (error) { showToast('Failed to load foreign stocks: ' + error.message, 'error'); return; }
  const rows = data || [];
  renderForeignStocks(rows);
  if (rows.length) fetchAndRefreshForeignPrices(rows);
}

// ── Edit modal ────────────────────────────────────────────────

let _editingForeignId = null;

function openForeignEditModal(row) {
  _editingForeignId = row ? row.id : null;
  const titleEl = document.getElementById('foreign-edit-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Holding' : 'Add Holding';
  document.getElementById('foreign-edit-symbol').value = row?.symbol || '';
  document.getElementById('foreign-edit-qty').value = row?.qty || '';
  document.getElementById('foreign-edit-price').value = row?.avg_price || '';
  document.getElementById('foreign-edit-currency').value = row?.currency || 'USD';
  document.getElementById('foreign-edit-modal').classList.remove('hidden');
}

function closeForeignEditModal() {
  _editingForeignId = null;
  document.getElementById('foreign-edit-modal').classList.add('hidden');
}

// ── CSV parser ────────────────────────────────────────────────
// Reads symbol, quantity, avg_price (stored to DB) + total_value (memory only).
// avg_price in CSV is in native currency (GBX = pence, USD = dollars).
// total_value in CSV is in display currency (GBP for MKS, USD for others).

function parseForeignCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const iSym = header.findIndex(h => h === 'symbol');
  const iQty = header.findIndex(h => h.includes('quantity') || h === 'qty');
  const iPrc = header.findIndex(h => h === 'avg_price' || h === 'avg price');
  const iVal = header.findIndex(h => h === 'total_value' || h === 'current_value');
  const iCcy = header.findIndex(h => h === 'currency' || h === 'ccy');

  if (iSym < 0 || iQty < 0 || iPrc < 0) return null;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const sym = (cols[iSym] || '').trim().toUpperCase();
    const qty = parseFloat(cols[iQty]);
    const prc = parseFloat(cols[iPrc]);
    if (!sym || isNaN(qty) || isNaN(prc)) continue;

    // Currency: CSV column wins, then .L suffix detection, then USD default
    const csvCcy = iCcy >= 0 ? (cols[iCcy] || '').trim().toUpperCase() : '';
    const isGBX = csvCcy === 'GBX' || csvCcy === 'GBP' || (!csvCcy && isLondonSymbol(sym));
    // total_value is in display currency; convert to native for consistent storage in _foreignLiveData
    const curValRaw = iVal >= 0 ? parseFloat(cols[iVal]) : NaN;
    const curValNative = !isNaN(curValRaw) ? (isGBX ? curValRaw * 100 : curValRaw) : null;
    const unitNative = curValNative != null && qty ? curValNative / qty : null;

    rows.push({
      symbol: sym,
      qty,
      avg_price: prc,
      currency: isGBX ? 'GBX' : (csvCcy && csvCcy !== 'GBX' && csvCcy !== 'GBP' ? csvCcy : 'USD'),
      // live data — memory only, NOT sent to DB
      _unitPrice: unitNative,
      _currentValue: curValNative,
    });
  }
  return rows;
}

// ── Fragment-loaded wiring ────────────────────────────────────

document.addEventListener('fragments-loaded', () => {

  let _parsedForeignRows = [];
  const csvInput = document.getElementById('foreign-csv-input');
  const previewSec = document.getElementById('foreign-preview-section');
  const previewBody = document.getElementById('foreign-preview-body');
  const countBadge = document.getElementById('foreign-stock-count');
  const importCount = document.getElementById('foreign-import-count');
  const confirmBtn = document.getElementById('foreign-import-confirm-btn');
  const fileLabel = document.getElementById('foreign-csv-filename');

  csvInput?.addEventListener('change', () => {
    const file = csvInput.files[0];
    if (!file) return;
    if (fileLabel) fileLabel.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseForeignCSV(e.target.result);
      if (!rows) { showToast('Cannot parse CSV — expected: symbol, quantity, avg_price', 'error'); return; }
      _parsedForeignRows = rows;
      if (countBadge) countBadge.textContent = rows.length;
      if (importCount) importCount.textContent = rows.length;
      confirmBtn?.classList.remove('hidden');
      previewSec?.classList.remove('hidden');

      if (previewBody) {
        previewBody.innerHTML = rows.map((r, i) => {
          const isGBX = r.currency === 'GBX';
          const factor = isGBX ? 100 : 1;
          const ccy = isGBX ? 'GBP' : 'USD';
          const avgD = (r.avg_price / factor).toFixed(2);
          const unitD = r._unitPrice != null ? (r._unitPrice / factor).toFixed(2) : '—';
          const curD = r._currentValue != null ? (r._currentValue / factor).toFixed(2) : '—';
          const tdS = 'padding:7px 14px;border-bottom:1px solid var(--border)';
          return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
            <td style="${tdS};font-weight:700">${r.symbol}</td>
            <td style="${tdS};text-align:right">${r.qty.toFixed(4)}</td>
            <td style="${tdS};text-align:right">${avgD}</td>
            <td style="${tdS};text-align:right">${unitD}</td>
            <td style="${tdS};text-align:right;font-weight:600">${ccy} ${curD}</td>
            <td style="${tdS};text-align:center">
              <span style="background:${isGBX ? '#e8f4fd' : '#e8fdf0'};color:${isGBX ? '#1a6fa8' : '#15803d'};padding:1px 9px;border-radius:20px;font-size:11px;font-weight:600">${ccy}</span>
            </td>
          </tr>`;
        }).join('');
      }
    };
    reader.readAsText(file);
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!_parsedForeignRows.length || !_currentUserId) return;
    confirmBtn.disabled = true; confirmBtn.textContent = 'Importing…';

    const { error: delErr } = await sb.from('foreign_stock_holdings').delete().eq('user_id', _currentUserId);
    if (delErr) {
      showToast('Delete failed: ' + delErr.message, 'error');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `📥 Import <span id="foreign-import-count">${_parsedForeignRows.length}</span> Holdings`;
      return;
    }

    const { error: insErr } = await sb.from('foreign_stock_holdings').insert(
      _parsedForeignRows.map(r => ({
        user_id: _currentUserId,
        symbol: r.symbol,
        qty: r.qty,
        avg_price: r.avg_price,   // only these 4 go to DB
        currency: r.currency,
      }))
    );
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `📥 Import <span id="foreign-import-count">${_parsedForeignRows.length}</span> Holdings`;
    if (insErr) { showToast('Import failed: ' + insErr.message, 'error'); return; }

    // Store live data in memory
    _foreignLiveData = {};
    _parsedForeignRows.forEach(r => {
      _foreignLiveData[r.symbol] = { unitPrice: r._unitPrice, currentValue: r._currentValue };
    });

    showToast(`${_parsedForeignRows.length} foreign holdings imported ✅`, 'success');
    closeForeignImportModal();
    loadForeignStocks(_currentUserId);
  });

  document.getElementById('foreign-import-close-btn')?.addEventListener('click', closeForeignImportModal);
  document.getElementById('foreign-import-cancel-btn')?.addEventListener('click', closeForeignImportModal);
  document.getElementById('foreign-import-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foreign-import-modal')) closeForeignImportModal();
  });

  // ── Edit modal ──────────────────────────────────────────────
  document.getElementById('foreign-edit-close-btn')?.addEventListener('click', closeForeignEditModal);
  document.getElementById('foreign-edit-cancel-btn')?.addEventListener('click', closeForeignEditModal);
  document.getElementById('foreign-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foreign-edit-modal')) closeForeignEditModal();
  });

  document.getElementById('foreign-edit-save-btn')?.addEventListener('click', async () => {
    const symbol = document.getElementById('foreign-edit-symbol').value.trim().toUpperCase();
    const qty = parseFloat(document.getElementById('foreign-edit-qty').value);
    const avgPrice = parseFloat(document.getElementById('foreign-edit-price').value);
    const currency = symbol.endsWith('.L') ? 'GBX' : 'USD';

    if (!symbol) { showToast('Symbol is required', 'error'); return; }
    if (isNaN(qty) || qty <= 0) { showToast('Quantity must be > 0', 'error'); return; }
    if (isNaN(avgPrice) || avgPrice <= 0) { showToast('Avg price must be > 0', 'error'); return; }

    const saveBtn = document.getElementById('foreign-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { symbol, qty, avg_price: avgPrice, currency };
    let error;
    if (_editingForeignId) {
      ({ error } = await sb.from('foreign_stock_holdings').update(payload).eq('id', _editingForeignId));
    } else {
      ({ error } = await sb.from('foreign_stock_holdings').insert({ ...payload, user_id: _currentUserId }));
    }
    saveBtn.textContent = '💾 Save'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
    showToast(_editingForeignId ? 'Updated ✅' : 'Added 🎉', 'success');
    closeForeignEditModal();
    loadForeignStocks(_currentUserId);
  });

  document.getElementById('foreign-import-btn')?.addEventListener('click', openForeignImportModal);
});

function openForeignImportModal() {
  const csvInput = document.getElementById('foreign-csv-input');
  if (csvInput) csvInput.value = '';
  const fileLabel = document.getElementById('foreign-csv-filename');
  if (fileLabel) fileLabel.textContent = '';
  document.getElementById('foreign-preview-section')?.classList.add('hidden');
  document.getElementById('foreign-import-confirm-btn')?.classList.add('hidden');
  document.getElementById('foreign-import-modal').classList.remove('hidden');
}

function closeForeignImportModal() {
  document.getElementById('foreign-import-modal').classList.add('hidden');
}
// ── Live price refresh ────────────────────────────────────────
// Yahoo Finance symbols:
//   USD stocks  → symbol as-is (e.g. AAPL, TSLA)
//   GBX stocks  → symbol + ".L"  (e.g. MKS → MKS.L, price returned in GBp)

async function fetchAndRefreshForeignPrices(rows) {
  const lastUpdateEl = document.getElementById('foreign-last-updated');
  const refreshBtn = document.getElementById('foreign-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching prices…';
  if (refreshBtn) refreshBtn.disabled = true;

  // Build Yahoo symbol list — translate DB symbols to correct Yahoo tickers + add FX pair
  const yahooSymbols = rows.map(r => YAHOO_SYMBOL_MAP[r.symbol.toUpperCase()] || r.symbol);
  const allSymbols = [...yahooSymbols, 'GBPUSD=X', 'USDINR=X'];  // fetch FX rates in same call

  let priceMap = null;
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(allSymbols.join(','))}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    priceMap = await res.json();
    if (priceMap.error) throw new Error(priceMap.error);
  } catch (err) {
    console.warn('[ForeignPrices] fetch failed:', err.message);
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    if (refreshBtn) refreshBtn.disabled = false;
    showToast('Live price fetch failed — check console', 'error');
    return;
  }

  if (refreshBtn) refreshBtn.disabled = false;

  // Extract GBP/USD rate (1 GBP = x USD); key returned as 'GBPUSD=X' with = stripped by API? check both
  const fxEntry = priceMap['GBPUSD=X'] || priceMap['GBPUSDX'] || priceMap['GBPUSD'];
  if (fxEntry) {
    _gbpUsdRate = typeof fxEntry === 'object' ? fxEntry.price : fxEntry;
    console.log('[ForeignPrices] GBP/USD rate:', _gbpUsdRate);
  }

  // Extract USD/INR rate (1 USD = x INR)
  const inrEntry = priceMap['USDINR=X'] || priceMap['USDINRX'] || priceMap['USDINR'];
  if (inrEntry) {
    _usdInrRate = typeof inrEntry === 'object' ? inrEntry.price : inrEntry;
    console.log('[ForeignPrices] USD/INR rate:', _usdInrRate);
  }

  // Build a priceMap keyed by DB symbol for easy lookup
  // API strips .L and .NS/.BO — e.g. CNDX.L → CNDX; BRK-B stays BRK-B
  const dbPriceMap = {};
  Object.entries(priceMap).forEach(([apiKey, val]) => {
    const dbSym = YAHOO_TICKER_TO_DB[apiKey] || apiKey;
    dbPriceMap[dbSym] = val;
  });

  rows.forEach(r => {
    const entry = dbPriceMap[r.symbol];
    if (!entry) return;
    const rawPrice = typeof entry === 'object' ? entry.price : entry;
    const stockName = typeof entry === 'object' ? (entry.name || null) : null;
    const nativeValue = rawPrice * (+r.qty || 0);
    _foreignLiveData[r.symbol] = { unitPrice: rawPrice, currentValue: nativeValue, name: stockName };
  });

  // Re-render table with updated live data
  renderForeignStocks(rows);

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpdateEl) lastUpdateEl.textContent = `🟢 Live · ${now}`;
}

// Wire refresh button
document.addEventListener('fragments-loaded', () => {
  document.getElementById('foreign-refresh-btn')?.addEventListener('click', () => {
    // Re-load from DB then refresh prices
    if (_currentUserId) loadForeignStocksAndRefresh(_currentUserId);
  });
});

async function loadForeignStocksAndRefresh(userId) {
  const { data, error } = await sb
    .from('foreign_stock_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('symbol', { ascending: true });
  if (error) { showToast('Failed to load: ' + error.message, 'error'); return; }
  const rows = data || [];
  if (rows.length) {
    renderForeignStocks(rows);         // show immediately with cached data
    fetchAndRefreshForeignPrices(rows); // then fetch live prices
  } else {
    renderForeignStocks(rows);
  }
}// ══════════════════════════════════════════════════════════════
//  FOREIGN STOCKS — Actual Invested
//  Table: foreign_actual_invested
//  Columns: id, user_id, entry_date, gbp_amount, inr_rate
//  Displayed: date | £GBP | ₹INR  (inr = gbp_amount × inr_rate)
// ══════════════════════════════════════════════════════════════

let _editingFaiId = null;

// ── Load ──────────────────────────────────────────────────────


// ── Refresh actual gain tiles using current live value tiles ──
function _refreshForeignActualGainTiles() {
  const actInvINREl = document.getElementById('foreign-actual-inv-inr');
  const actInvGBPEl = document.getElementById('foreign-actual-inv-gbp');
  if (!actInvINREl || !actInvINREl.textContent || actInvINREl.textContent === '—') return;

  // INR
  const actINR = parseFloat(actInvINREl.textContent.replace(/[^\d.-]/g, '')) || 0;
  const curINREl = document.getElementById('foreign-total-val-inr');
  const curINR = curINREl ? parseFloat(curINREl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  if (actINR > 0 && curINR > 0) {
    const gainINR = curINR - actINR;
    const pct = ` (${((gainINR / actINR) * 100).toFixed(1)}%)`;
    const el = document.getElementById('foreign-actual-gain-inr');
    if (el) {
      el.textContent = (gainINR >= 0 ? '+' : '') + INR(Math.abs(gainINR)) + pct;
      el.style.color = gainINR > 0 ? 'var(--green)' : gainINR < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  }

  // GBP
  if (!actInvGBPEl || actInvGBPEl.textContent === '—') return;
  const actGBP = parseFloat(actInvGBPEl.textContent.replace(/[^\d.-]/g, '')) || 0;
  const curGBPEl = document.getElementById('foreign-total-val-gbp');
  const curGBP = curGBPEl ? parseFloat(curGBPEl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  if (actGBP > 0 && curGBP > 0) {
    const gainGBP = curGBP - actGBP;
    const pct = ` (${((gainGBP / actGBP) * 100).toFixed(1)}%)`;
    const el = document.getElementById('foreign-actual-gain-gbp');
    if (el) {
      el.textContent = (gainGBP >= 0 ? '+' : '') + '\u00a3' + Math.abs(gainGBP).toFixed(2) + pct;
      el.style.color = gainGBP > 0 ? 'var(--green)' : gainGBP < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  }
}

async function loadForeignActualInvested(userId) {
  const section = document.getElementById('foreign-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('foreign-monthly-body');
  if (body) body.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>';

  const { data, error } = await sb
    .from('foreign_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">' + error.message + '</td></tr>';
    return;
  }
  renderForeignActualInvested(data || []);
}

// ── Render ────────────────────────────────────────────────────

function renderForeignActualInvested(rows) {
  const body    = document.getElementById('foreign-monthly-body');
  const totalEl = document.getElementById('foreign-monthly-total');
  if (!body) return;

  const totalGBP = rows.reduce((s, r) => s + (+r.gbp_amount || 0), 0);
  const totalINR = rows.reduce((s, r) => s + ((+r.gbp_amount || 0) * (+r.inr_rate || 0)), 0);
  if (totalEl) totalEl.textContent = '£' + totalGBP.toFixed(2) + '  ·  ' + INR(totalINR);

  // ── Populate Actual Invested tiles in INR and GBP rows ──
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // INR row
  setEl('foreign-actual-inv-inr', totalINR > 0 ? INR(totalINR) : '—');
  const curValINREl = document.getElementById('foreign-total-val-inr');
  const curValINR = curValINREl ? parseFloat(curValINREl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  if (totalINR > 0 && curValINR > 0) {
    const gainINR = curValINR - totalINR;
    const gainINRPct = totalINR > 0 ? ` (${((gainINR / totalINR) * 100).toFixed(1)}%)` : '';
    const gainINREl = document.getElementById('foreign-actual-gain-inr');
    if (gainINREl) {
      gainINREl.textContent = (gainINR >= 0 ? '+' : '') + INR(gainINR) + gainINRPct;
      gainINREl.style.color = gainINR > 0 ? 'var(--green)' : gainINR < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  } else {
    setEl('foreign-actual-gain-inr', '—');
  }

  // GBP row
  setEl('foreign-actual-inv-gbp', totalGBP > 0 ? '£' + totalGBP.toFixed(2) : '—');
  const curValGBPEl = document.getElementById('foreign-total-val-gbp');
  const curValGBP = curValGBPEl ? parseFloat(curValGBPEl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  if (totalGBP > 0 && curValGBP > 0) {
    const gainGBP = curValGBP - totalGBP;
    const gainGBPPct = totalGBP > 0 ? ` (${((gainGBP / totalGBP) * 100).toFixed(1)}%)` : '';
    const gainGBPEl = document.getElementById('foreign-actual-gain-gbp');
    if (gainGBPEl) {
      gainGBPEl.textContent = (gainGBP >= 0 ? '+' : '') + '£' + Math.abs(gainGBP).toFixed(2) + gainGBPPct;
      gainGBPEl.style.color = gainGBP > 0 ? 'var(--green)' : gainGBP < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  } else {
    setEl('foreign-actual-gain-gbp', '—');
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
      '<td class="fai-cb-wrap" data-id="' + r.id + '" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="fai-cb" data-id="' + r.id + '" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>' +
      '<td style="' + thS + ';color:var(--accent);font-weight:500">' + dateStr + '</td>' +
      '<td style="' + thS + ';text-align:right;font-weight:600">£' + (+r.gbp_amount).toFixed(2) + '</td>' +
      '<td style="' + thS + ';text-align:right;color:var(--muted2)">' + INR(inrAmt) + '</td>' +
      '<td style="' + thS + ';white-space:nowrap">' +
        '<button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" ' +
          'data-id="' + r.id + '" data-date="' + r.entry_date + '" data-gbp="' + r.gbp_amount + '" data-rate="' + r.inr_rate + '" ' +
          'class="fai-edit-btn" title="Edit">✏️</button>' +
      '</td>' +
    '</tr>';
  }).join('') +
    '<tr style="background:var(--surface2)">' +
    '<td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>' +
    '<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">£' + totalGBP.toFixed(2) + '</td>' +
    '<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">' + INR(totalINR) + '</td>' +
    '<td></td></tr>';

  if (window['_foreign_bindCheckboxes']) window['_foreign_bindCheckboxes']();
  body.querySelectorAll('.fai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openFaiModal({
      id: btn.dataset.id, entry_date: btn.dataset.date,
      gbp_amount: btn.dataset.gbp, inr_rate: btn.dataset.rate
    }));
  });
}

// ── Add / Edit modal ──────────────────────────────────────────

function openFaiModal(row = null) {
  _editingFaiId = row?.id || null;
  const titleEl = document.getElementById('foreign-invested-modal-title');
  const saveBtn = document.getElementById('foreign-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '💾 Save Entry';

  document.getElementById('fai-date').value     = row?.entry_date || '';
  document.getElementById('fai-gbp').value      = row?.gbp_amount || '';
  document.getElementById('fai-inr-rate').value = row?.inr_rate   || '';
  _updateFaiPreview();

  document.getElementById('foreign-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeFaiModal() {
  document.getElementById('foreign-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingFaiId = null;
}

function _updateFaiPreview() {
  const gbp  = parseFloat(document.getElementById('fai-gbp')?.value)     || 0;
  const rate = parseFloat(document.getElementById('fai-inr-rate')?.value) || 0;
  const preview    = document.getElementById('fai-inr-preview');
  const previewVal = document.getElementById('fai-inr-preview-val');
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
  const modal = document.getElementById('foreign-invested-modal');

  document.getElementById('foreign-invested-add-btn')?.addEventListener('click',    () => openFaiModal());
  document.getElementById('foreign-invested-close-btn')?.addEventListener('click',  closeFaiModal);
  document.getElementById('foreign-invested-cancel-btn')?.addEventListener('click', closeFaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeFaiModal(); });

  // Live INR preview while typing
  document.getElementById('fai-gbp')?.addEventListener('input',      _updateFaiPreview);
  document.getElementById('fai-inr-rate')?.addEventListener('input', _updateFaiPreview);

  document.getElementById('foreign-invested-save-btn')?.addEventListener('click', async () => {
    const date    = document.getElementById('fai-date').value;
    const gbp     = parseFloat(document.getElementById('fai-gbp').value);
    const inrRate = parseFloat(document.getElementById('fai-inr-rate').value);

    if (!date)                    { showToast('Date is required',         'error'); return; }
    if (!gbp     || gbp     <= 0) { showToast('GBP amount must be > 0',   'error'); return; }
    if (!inrRate || inrRate <= 0) { showToast('INR rate must be > 0',     'error'); return; }

    const saveBtn = document.getElementById('foreign-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, gbp_amount: gbp, inr_rate: inrRate };
    let op;
    if (_editingFaiId) {
      op = sb.from('foreign_actual_invested').update(payload).eq('id', _editingFaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('foreign_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingFaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeFaiModal();
      loadForeignActualInvested(_currentUserId);
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  Bulk select / delete wiring
// ══════════════════════════════════════════════════════════════
(function () {
  var _sel = false;
  var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function _enter() {
    _sel = true;
    var btn = document.getElementById('foreign-select-btn');
    if (btn) { btn.innerHTML = '✕ Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
    document.getElementById('foreign-bulk-bar')?.classList.remove('hidden');
    document.querySelectorAll('.fai-cb-wrap').forEach(c => { c.style.display = ''; });
    _upd();
  }

  function _exit() {
    _sel = false;
    var btn = document.getElementById('foreign-select-btn');
    if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
    document.getElementById('foreign-bulk-bar')?.classList.add('hidden');
    document.getElementById('foreign-bulk-normal').style.display = 'flex';
    document.getElementById('foreign-bulk-confirm').style.display = 'none';
    document.querySelectorAll('.fai-cb-wrap').forEach(c => { c.style.display = 'none'; });
    document.querySelectorAll('.fai-cb').forEach(c => { c.checked = false; });
    _upd();
  }

  function _upd() {
    var n = document.querySelectorAll('.fai-cb:checked').length;
    var countEl = document.getElementById('foreign-bulk-count');
    var delBtn  = document.getElementById('foreign-bulk-delete');
    if (countEl) countEl.textContent = n + ' selected';
    if (delBtn)  delBtn.disabled = n === 0;
  }

  document.addEventListener('fragments-loaded', function () {
    document.getElementById('foreign-select-btn')?.addEventListener('click', function () {
      if (_sel) _exit(); else _enter();
    });
    document.getElementById('foreign-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('foreign-bulk-delete')?.addEventListener('click', function () {
      var n = document.querySelectorAll('.fai-cb:checked').length;
      if (!n) return;
      document.getElementById('foreign-bulk-normal').style.display = 'none';
      document.getElementById('foreign-bulk-confirm').style.display = 'flex';
      document.getElementById('foreign-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('foreign-bulk-no')?.addEventListener('click', function () {
      document.getElementById('foreign-bulk-normal').style.display = 'flex';
      document.getElementById('foreign-bulk-confirm').style.display = 'none';
    });

    document.getElementById('foreign-bulk-yes')?.addEventListener('click', async function () {
      var checked = [...document.querySelectorAll('.fai-cb:checked')];
      if (!checked.length) return;
      var yesBtn = document.getElementById('foreign-bulk-yes');
      yesBtn.textContent = 'Deleting…'; yesBtn.disabled = true;
      var anyErr = false;
      for (var cb of checked) {
        var r = await sb.from('foreign_actual_invested').delete().eq('id', cb.dataset.id);
        if (r.error) { showToast('Delete failed: ' + r.error.message, 'error'); anyErr = true; }
      }
      yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
      if (!anyErr) showToast(checked.length + ' ' + (checked.length === 1 ? 'entry' : 'entries') + ' deleted', 'success');
      _exit();
      loadForeignActualInvested(_currentUserId);
    });
  });

  window['_foreign_bindCheckboxes'] = function () {
    document.querySelectorAll('.fai-cb').forEach(cb => {
      cb.addEventListener('change', _upd);
    });
    document.querySelectorAll('.fai-cb-wrap').forEach(c => {
      c.style.display = _sel ? '' : 'none';
    });
    if (_sel) _upd();
  };
})();