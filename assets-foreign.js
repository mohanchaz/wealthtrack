// ══════════════════════════════════════════════════════════════
//  FOREIGN STOCKS  — foreign_stock_holdings
//  DB stores: symbol, qty, avg_price, currency
//  Unit price & current value are parsed from CSV into memory
//  and never written to the DB.
// ══════════════════════════════════════════════════════════════

// GBX symbols: only explicitly listed symbols — .L suffix alone does NOT mean GBX
const GBX_HARDCODED = new Set(['MKS']);
const isLondonSymbol = sym => typeof sym === 'string' && GBX_HARDCODED.has(sym.toUpperCase().replace(/\.L$/i, ''));

// In-memory map: symbol → { unitPrice (native), currentValue (native) }
// Populated at import time, lives until page refresh.
let _foreignLiveData = {};

// ── Render table ──────────────────────────────────────────────

function renderForeignStocks(rows) {
  const tbody = document.getElementById('assets-table-body');
  const thead = document.getElementById('assets-thead-row');
  if (!tbody) return;

  if (thead) {
    thead.innerHTML = `
      <th>Symbol</th>
      <th style="text-align:right">Quantity</th>
      <th style="text-align:right">Avg Price</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:center">Currency</th>
      <th style="text-align:right">Invested</th>
      <th style="text-align:right">Current Value</th>
      <th style="text-align:right">Gain / Loss</th>
      <th></th>`;
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="padding:32px;text-align:center;color:var(--muted2)">
      No foreign holdings yet — click <b>📥 Import CSV</b> to add
    </td></tr>`;
    ['assets-total-invested','assets-total-value','assets-total-gain'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    return;
  }

  let totalInvUSD = 0, totalInvGBP = 0;
  let totalCurUSD = 0, totalCurGBP = 0;

  tbody.innerHTML = rows.map((r, i) => {
    const isGBX    = isLondonSymbol(r.symbol) || r.currency === 'GBX';
    const factor   = isGBX ? 100 : 1;
    const ccy      = isGBX ? 'GBP' : 'USD';

    const avgDisp  = r.avg_price / factor;
    const live     = _foreignLiveData[r.symbol];
    const unitDisp = live?.unitPrice    != null ? live.unitPrice    / factor : null;
    const curDisp  = live?.currentValue != null ? live.currentValue / factor : null;
    const invested = r.qty * avgDisp;
    const curVal   = curDisp ?? (unitDisp != null ? r.qty * unitDisp : null);

    if (isGBX) { totalInvGBP += invested; if (curVal != null) totalCurGBP += curVal; }
    else        { totalInvUSD += invested; if (curVal != null) totalCurUSD += curVal; }

    const gain     = curVal != null ? curVal - invested : null;
    const gainPct  = gain != null && invested ? ` (${((gain / invested) * 100).toFixed(1)}%)` : '';
    const gainColor = gain == null ? 'var(--muted2)' : gain > 0 ? 'var(--green)' : gain < 0 ? 'var(--danger)' : 'var(--muted)';
    const gainStr  = gain == null ? '<span style="color:var(--muted2)">—</span>'
                                  : `${gain >= 0 ? '+' : ''}${ccy} ${gain.toFixed(2)}<span style="font-size:11px">${gainPct}</span>`;

    const badge = `<span style="background:${isGBX ? '#e8f4fd' : '#e8fdf0'};color:${isGBX ? '#1a6fa8' : '#15803d'};padding:1px 9px;border-radius:20px;font-size:11px;font-weight:600">${ccy}</span>`;
    const tdS   = 'padding:10px 14px;border-bottom:1px solid var(--border)';

    return `<tr data-id="${r.id}" style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td style="${tdS};font-weight:700">${r.symbol}</td>
      <td style="${tdS};text-align:right;font-variant-numeric:tabular-nums">${(+r.qty).toFixed(4)}</td>
      <td style="${tdS};text-align:right;font-variant-numeric:tabular-nums">${avgDisp.toFixed(2)}</td>
      <td style="${tdS};text-align:right;font-variant-numeric:tabular-nums">${unitDisp != null ? unitDisp.toFixed(2) : '<span style="color:var(--muted2)">—</span>'}</td>
      <td style="${tdS};text-align:center">${badge}</td>
      <td style="${tdS};text-align:right;font-variant-numeric:tabular-nums">${ccy} ${invested.toFixed(2)}</td>
      <td style="${tdS};text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${curVal != null ? `${ccy} ${curVal.toFixed(2)}` : '<span style="color:var(--muted2)">—</span>'}</td>
      <td style="${tdS};text-align:right;font-weight:600;color:${gainColor};font-variant-numeric:tabular-nums">${gainStr}</td>
      <td style="${tdS};text-align:right">
        <button class="foreign-edit-btn" data-id="${r.id}"
          style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 5px;opacity:0.65;transition:opacity 0.15s"
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

  // Summary stats
  const fmt = (usd, gbp) => {
    const p = [];
    if (usd) p.push(`USD ${usd.toFixed(2)}`);
    if (gbp) p.push(`GBP ${gbp.toFixed(2)}`);
    return p.join('  +  ') || '—';
  };
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('assets-total-invested', fmt(totalInvUSD, totalInvGBP));
  setEl('assets-total-value',    fmt(totalCurUSD || totalInvUSD, totalCurGBP || totalInvGBP));

  const gainUSD = totalCurUSD - totalInvUSD;
  const gainGBP = totalCurGBP - totalInvGBP;
  const gainParts = [];
  if (totalInvUSD) gainParts.push(`${gainUSD >= 0 ? '+' : ''}USD ${gainUSD.toFixed(2)}`);
  if (totalInvGBP) gainParts.push(`${gainGBP >= 0 ? '+' : ''}GBP ${gainGBP.toFixed(2)}`);
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = gainParts.join('  +  ') || '—';
    gainEl.style.color = (gainUSD + gainGBP) > 0 ? 'var(--green)' : (gainUSD + gainGBP) < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  const countEl = document.getElementById('assets-count-inline');
  if (countEl) countEl.textContent = `${rows.length} holding${rows.length !== 1 ? 's' : ''}`;
}

// ── Load ──────────────────────────────────────────────────────

async function loadForeignStocks(userId) {
  const tbody = document.getElementById('assets-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="padding:24px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

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
  document.getElementById('foreign-edit-symbol').value   = row?.symbol   || '';
  document.getElementById('foreign-edit-qty').value      = row?.qty      || '';
  document.getElementById('foreign-edit-price').value    = row?.avg_price || '';
  document.getElementById('foreign-edit-currency').value = row?.currency  || 'USD';
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
    const sym  = (cols[iSym] || '').trim().toUpperCase();
    const qty  = parseFloat(cols[iQty]);
    const prc  = parseFloat(cols[iPrc]);
    if (!sym || isNaN(qty) || isNaN(prc)) continue;

    // Currency: CSV column wins, then .L suffix detection, then USD default
    const csvCcy = iCcy >= 0 ? (cols[iCcy] || '').trim().toUpperCase() : '';
    const isGBX  = csvCcy === 'GBX' || csvCcy === 'GBP' || (!csvCcy && isLondonSymbol(sym));
    // total_value is in display currency; convert to native for consistent storage in _foreignLiveData
    const curValRaw = iVal >= 0 ? parseFloat(cols[iVal]) : NaN;
    const curValNative = !isNaN(curValRaw) ? (isGBX ? curValRaw * 100 : curValRaw) : null;
    const unitNative   = curValNative != null && qty ? curValNative / qty : null;

    rows.push({
      symbol:        sym,
      qty,
      avg_price:     prc,
      currency:      isGBX ? 'GBX' : (csvCcy && csvCcy !== 'GBX' && csvCcy !== 'GBP' ? csvCcy : 'USD'),
      // live data — memory only, NOT sent to DB
      _unitPrice:    unitNative,
      _currentValue: curValNative,
    });
  }
  return rows;
}

// ── Fragment-loaded wiring ────────────────────────────────────

document.addEventListener('fragments-loaded', () => {

  let _parsedForeignRows = [];
  const csvInput    = document.getElementById('foreign-csv-input');
  const previewSec  = document.getElementById('foreign-preview-section');
  const previewBody = document.getElementById('foreign-preview-body');
  const countBadge  = document.getElementById('foreign-stock-count');
  const importCount = document.getElementById('foreign-import-count');
  const confirmBtn  = document.getElementById('foreign-import-confirm-btn');
  const fileLabel   = document.getElementById('foreign-csv-filename');

  csvInput?.addEventListener('change', () => {
    const file = csvInput.files[0];
    if (!file) return;
    if (fileLabel) fileLabel.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseForeignCSV(e.target.result);
      if (!rows) { showToast('Cannot parse CSV — expected: symbol, quantity, avg_price', 'error'); return; }
      _parsedForeignRows = rows;
      if (countBadge)  countBadge.textContent = rows.length;
      if (importCount) importCount.textContent = rows.length;
      confirmBtn?.classList.remove('hidden');
      previewSec?.classList.remove('hidden');

      if (previewBody) {
        previewBody.innerHTML = rows.map((r, i) => {
          const isGBX  = r.currency === 'GBX';
          const factor = isGBX ? 100 : 1;
          const ccy    = isGBX ? 'GBP' : 'USD';
          const avgD   = (r.avg_price  / factor).toFixed(2);
          const unitD  = r._unitPrice    != null ? (r._unitPrice    / factor).toFixed(2) : '—';
          const curD   = r._currentValue != null ? (r._currentValue / factor).toFixed(2) : '—';
          const tdS    = 'padding:7px 14px;border-bottom:1px solid var(--border)';
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
        user_id:   _currentUserId,
        symbol:    r.symbol,
        qty:       r.qty,
        avg_price: r.avg_price,   // only these 4 go to DB
        currency:  r.currency,
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

  document.getElementById('foreign-import-close-btn')?.addEventListener('click',  closeForeignImportModal);
  document.getElementById('foreign-import-cancel-btn')?.addEventListener('click', closeForeignImportModal);
  document.getElementById('foreign-import-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foreign-import-modal')) closeForeignImportModal();
  });

  // ── Edit modal ──────────────────────────────────────────────
  document.getElementById('foreign-edit-close-btn')?.addEventListener('click',  closeForeignEditModal);
  document.getElementById('foreign-edit-cancel-btn')?.addEventListener('click', closeForeignEditModal);
  document.getElementById('foreign-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foreign-edit-modal')) closeForeignEditModal();
  });

  document.getElementById('foreign-edit-save-btn')?.addEventListener('click', async () => {
    const symbol   = document.getElementById('foreign-edit-symbol').value.trim().toUpperCase();
    const qty      = parseFloat(document.getElementById('foreign-edit-qty').value);
    const avgPrice = parseFloat(document.getElementById('foreign-edit-price').value);
    const currency = symbol.endsWith('.L') ? 'GBX' : 'USD';

    if (!symbol)                       { showToast('Symbol is required',    'error'); return; }
    if (isNaN(qty)      || qty <= 0)   { showToast('Quantity must be > 0',  'error'); return; }
    if (isNaN(avgPrice) || avgPrice<=0){ showToast('Avg price must be > 0', 'error'); return; }

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
  const refreshBtn   = document.getElementById('foreign-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching prices…';
  if (refreshBtn)   refreshBtn.disabled = true;

  // Build Yahoo symbol list — symbols already include .L for London stocks
  const yahooSymbols = rows.map(r => r.symbol);

  let priceMap = null;
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(yahooSymbols.join(','))}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    priceMap = await res.json();
    if (priceMap.error) throw new Error(priceMap.error);
  } catch (err) {
    console.warn('[ForeignPrices] fetch failed:', err.message);
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    if (refreshBtn)   refreshBtn.disabled = false;
    showToast('Live price fetch failed — check console', 'error');
    return;
  }

  if (refreshBtn) refreshBtn.disabled = false;

  // Update _foreignLiveData from the fetched map
  // priceMap keys = stripped Yahoo symbol (no .L, no .NS suffix from the API function)
  rows.forEach(r => {
    const isGBX    = isLondonSymbol(r.symbol) || r.currency === 'GBX';
    // API now strips .L too, so key is always the bare symbol (BRK-B, CNDX, MKS…)
    const bareKey  = r.symbol.replace(/\.L$/i, '');
    const entry    = priceMap[bareKey];
    if (!entry) return;
    const rawPrice = typeof entry === 'object' ? entry.price : entry;
    // Yahoo returns GBp (pence) for .L symbols — store natively
    // factor: GBX stored as pence (×1), GBP treated same, USD no conversion
    const nativePrice   = rawPrice;
    const nativeValue   = nativePrice * (+r.qty || 0);
    _foreignLiveData[r.symbol] = { unitPrice: nativePrice, currentValue: nativeValue };
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
}