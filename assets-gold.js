// ══════════════════════════════════════════════════════════════
//  ZERODHA GOLD — live prices, CSV import, edit modal
//  Table: gold_holdings (holding_name, holding_type, qty, avg_cost, yahoo_symbol)
//  DOM cells keyed by holding_name (per renderAssetsTable liveKey)
// ══════════════════════════════════════════════════════════════

// ── Symbol resolution ─────────────────────────────────────────
// Returns e.g. "GOLDBEES.NS" or "GOLDBEES.BO"
function resolveGoldSymbol(asset, suffix) {
  if (asset.yahoo_symbol && asset.yahoo_symbol.trim()) {
    const base = asset.yahoo_symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    return base + '.' + suffix;
  }
  // Fallback: treat holding_name as the ticker
  const name = (asset.holding_name || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!name) return null;
  return name + '.' + suffix;
}

// ── Live price refresh ────────────────────────────────────────

async function fetchAndRefreshGoldPrices(assets) {
  const lastUpdateEl = document.getElementById('gold-last-updated');
  const refreshBtn   = document.getElementById('gold-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live prices…';
  if (refreshBtn)   refreshBtn.disabled = true;

  // Fetch both NS and BO exchanges in parallel — merge results
  const nsSymbols = [...new Set(assets.map(a => resolveGoldSymbol(a, 'NS')).filter(Boolean))];
  const boSymbols = [...new Set(assets.map(a => resolveGoldSymbol(a, 'BO')).filter(Boolean))];

  const [nsPrices, boPrices] = await Promise.all([
    nsSymbols.length ? fetchLivePricesRaw(nsSymbols).catch(() => null) : Promise.resolve(null),
    boSymbols.length ? fetchLivePricesRaw(boSymbols).catch(() => null) : Promise.resolve(null),
  ]);

  if (refreshBtn) refreshBtn.disabled = false;

  // NS takes precedence; BO fills gaps
  const prices = { ...(boPrices || {}), ...(nsPrices || {}) };

  if (!Object.keys(prices).length) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    showToast('Live gold price fetch failed — check browser console', 'error');
    return;
  }

  // getLTP strips suffix — GOLDBEES.NS and GOLDBEES.BO both resolve to key "GOLDBEES"
  function getGoldLTP(asset) {
    const base = (resolveGoldSymbol(asset, 'NS') || '').replace(/\.(NS|BO)$/i, '');
    return base ? getLTP(prices, base) : null;
  }

  // Totals
  let totalValue = 0, totalInvested = 0;
  assets.forEach(a => {
    const qty      = +a.qty || 0;
    const ltp      = getGoldLTP(a);
    totalInvested += qty * (+a.avg_cost || 0);
    totalValue    += qty * (ltp || +a.avg_cost || 0);
  });

  // Update DOM cells (keyed by holding_name)
  assets.forEach(a => {
    const ltp        = getGoldLTP(a);
    const holdingKey = a.holding_name;

    const ltpCell = document.querySelector(`[data-live-_ltp="${holdingKey}"]`);
    if (ltpCell) ltpCell.textContent = ltp ? INR(ltp) : '—';

    if (!ltp) return;

    const qty         = +a.qty || 0;
    const curVal      = qty * ltp;
    const investedAmt = qty * (+a.avg_cost || 0);
    const gain        = curVal - investedAmt;
    const gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct    = totalValue > 0 ? (curVal / totalValue) * 100 : 0;

    const cvCell = document.querySelector(`[data-live-current_value="${holdingKey}"]`);
    if (cvCell) cvCell.textContent = INR(curVal);

    const allocCell = document.querySelector(`[data-live-_alloc_pct="${holdingKey}"]`);
    if (allocCell) {
      const bw = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end"><span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block"><span style="display:block;height:100%;width:${bw}%;background:var(--accent);border-radius:99px"></span></span><b style="font-size:12px;color:var(--accent)">${allocPct.toFixed(1)}%</b></span>`;
    }

    const gainTd = document.querySelector(`[data-live-gain="${holdingKey}"]`);
    if (gainTd) {
      const arrow = gain >= 0 ? '▲' : '▼';
      const bc    = gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'zero';
      gainTd.innerHTML = `<span class="gain-badge ${bc}">${arrow} ${INR(Math.abs(gain))}${gainPct ? ` (${gainPct}%)` : ''}</span>`;
    }
  });

  // Summary cards
  const totalGain    = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? ` (${((totalGain / totalInvested) * 100).toFixed(1)}%)` : '';
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('assets-total-value',    INR(totalValue));
  setEl('assets-total-invested', INR(totalInvested));
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + totalGainPct;
    gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';
  }
  const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpdateEl) lastUpdateEl.textContent = `🟢 Live · ${nowStr}`;
}

// ══════════════════════════════════════════════════════════════
//  CSV Import
// ══════════════════════════════════════════════════════════════

const GOLD_SYMBOL_MAP = [
  ['goldbees',     'GOLDBEES'],
  ['sgold',        'SGOLD'],
  ['hdfcgold',     'HDFCGOLD'],
  ['kotakgold',    'KOTAKGOLD'],
  ['sbietfgold',   'SBIETFGOLD'],
  ['utigold',      'UTIGOLD'],
  ['axisgold',     'AXISGOLD'],
  ['ivzingold',    'IVZINGOLD'],
  ['qgoldhalf',    'QGOLDHALF'],
  ['nippon gold',  'GOLDBEES'],
  ['hdfc gold',    'HDFCGOLD'],
  ['kotak gold',   'KOTAKGOLD'],
  ['sbi gold',     'SBIETFGOLD'],
  ['uti gold',     'UTIGOLD'],
  ['axis gold',    'AXISGOLD'],
  ['invesco gold', 'IVZINGOLD'],
  ['quantum gold', 'QGOLDHALF'],
  ['gold savings', 'GOLDBEES'],
  ['gold etf',     'GOLDBEES'],
];

function guessGoldYahooSymbol(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (/^[A-Z0-9]+$/.test(trimmed)) return trimmed + '.NS';
  const lower = trimmed.toLowerCase();
  for (const [frag, ticker] of GOLD_SYMBOL_MAP) {
    if (lower.includes(frag)) return ticker + '.NS';
  }
  return null;
}

function parseGoldCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rawHeader = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  function find(...needles) {
    for (const needle of needles) {
      const idx = rawHeader.findIndex(h => h.toLowerCase().includes(needle.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  }
  const iName    = find('instrument', 'fund name', 'scheme', 'name', 'symbol');
  const iQty     = find('qty', 'units', 'quantity');
  const iAvgCost = find('avg. cost', 'avg cost', 'avg nav', 'average cost', 'average');
  const iType    = find('type');
  const holdings = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = [];
    let inQ = false, cur = '';
    for (let j = 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    const clean = idx => idx >= 0 ? (cols[idx] || '').replace(/^"|"$/g, '').trim() : '';
    const num   = idx => idx >= 0 ? (parseFloat((cols[idx] || '').replace(/[,₹\s]/g, '')) || 0) : 0;
    const rawName = clean(iName);
    if (!rawName) continue;
    const isGoldTicker = /goldbees|sgold|hdfcgold|kotakgold|sbietfgold|utigold|axisgold|ivzingold|qgoldhalf/i.test(rawName);
    const isGoldName   = /gold/i.test(rawName);
    if (!isGoldTicker && !isGoldName) continue;
    const qty     = num(iQty);
    const avgCost = num(iAvgCost);
    const hType   = clean(iType) || (isGoldTicker ? 'ETF' : 'MF');
    holdings.push({ holding_name: rawName, holding_type: hType, qty, avg_cost: avgCost, yahoo_symbol: guessGoldYahooSymbol(rawName) });
  }
  return holdings;
}

let _goldPreviewRows = [];

function openGoldImportModal() {
  _goldPreviewRows = [];
  const inp = document.getElementById('gold-csv-input');
  if (inp) inp.value = '';
  const fn = document.getElementById('gold-csv-filename');
  if (fn) fn.textContent = '';
  document.getElementById('gold-preview-section')?.classList.add('hidden');
  document.getElementById('gold-import-confirm-btn')?.classList.add('hidden');
  document.getElementById('gold-import-modal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGoldImportModal() {
  document.getElementById('gold-import-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function handleGoldCSV(file) {
  if (!file) return;
  const fn = document.getElementById('gold-csv-filename');
  if (fn) fn.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    _goldPreviewRows = parseGoldCSV(e.target.result);
    const count = _goldPreviewRows.length;
    const countEl       = document.getElementById('gold-holding-count');
    const importCountEl = document.getElementById('gold-import-count');
    if (countEl)       countEl.textContent       = count;
    if (importCountEl) importCountEl.textContent = count;
    const thead = document.getElementById('gold-preview-thead');
    const tbody = document.getElementById('gold-preview-body');
    if (!thead || !tbody) return;
    const thS = 'padding:7px 10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';
    thead.innerHTML = `<tr>
      <th style="${thS};text-align:center;width:32px">✓</th>
      <th style="${thS};text-align:left">Name</th>
      <th style="${thS}">Type</th>
      <th style="${thS};text-align:right">Qty</th>
      <th style="${thS};text-align:right">Avg Cost</th>
      <th style="${thS};text-align:left">Yahoo Symbol</th>
    </tr>`;
    const tdS = 'padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px';
    tbody.innerHTML = count === 0
      ? `<tr><td colspan="6" style="padding:18px;text-align:center;color:var(--muted2)">No gold holdings found in this CSV</td></tr>`
      : _goldPreviewRows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}" data-idx="${i}">
          <td style="${tdS};text-align:center"><input type="checkbox" class="gold-row-chk" data-idx="${i}" checked style="cursor:pointer;width:15px;height:15px"></td>
          <td style="${tdS};font-weight:600">${r.holding_name}</td>
          <td style="${tdS};text-align:center">${r.holding_type || '—'}</td>
          <td style="${tdS};text-align:right">${r.qty}</td>
          <td style="${tdS};text-align:right">${INR(r.avg_cost)}</td>
          <td style="${tdS};font-size:11px;color:var(--muted2)">${r.yahoo_symbol || '<span style="color:var(--danger)">Not mapped</span>'}</td>
        </tr>`).join('');
    const updateCount = () => {
      const checked = tbody.querySelectorAll('.gold-row-chk:checked').length;
      if (countEl)       countEl.textContent       = checked;
      if (importCountEl) importCountEl.textContent = checked;
      document.getElementById('gold-import-confirm-btn')?.classList.toggle('hidden', checked === 0);
    };
    tbody.querySelectorAll('.gold-row-chk').forEach(chk => chk.addEventListener('change', updateCount));
    document.getElementById('gold-preview-section')?.classList.remove('hidden');
    document.getElementById('gold-import-confirm-btn')?.classList.toggle('hidden', count === 0);
  };
  reader.readAsText(file);
}

async function importGoldHoldings(allRows) {
  const checkedIdxs = new Set([...document.querySelectorAll('.gold-row-chk:checked')].map(c => +c.dataset.idx));
  const rows = allRows.filter((_, i) => checkedIdxs.has(i));
  if (!rows.length) { showToast('No holdings selected', 'error'); return; }
  const confirmBtn = document.getElementById('gold-import-confirm-btn');
  if (confirmBtn) { confirmBtn.textContent = 'Importing…'; confirmBtn.disabled = true; }
  const { error } = await sb.from('gold_holdings').upsert(
    rows.map(r => ({
      user_id:      _currentUserId,
      holding_name: r.holding_name,
      holding_type: r.holding_type || 'ETF',
      qty:          r.qty,
      avg_cost:     r.avg_cost,
      yahoo_symbol: r.yahoo_symbol || null,
      imported_at:  new Date().toISOString(),
    })),
    { onConflict: 'user_id,holding_name' }
  );
  if (confirmBtn) { confirmBtn.textContent = `📥 Import ${rows.length} Holdings`; confirmBtn.disabled = false; }
  if (error) { showToast('Import failed: ' + error.message, 'error'); }
  else { showToast(`✅ Imported ${rows.length} gold holding${rows.length !== 1 ? 's' : ''}!`, 'success'); closeGoldImportModal(); loadAssets(_currentUserId, 'Gold'); }
}

// ── Edit modal ────────────────────────────────────────────────

let _editingGoldId = null;

function openGoldEditModal(row) {
  _editingGoldId = row ? (row.id || null) : null;
  const titleEl = document.getElementById('gold-edit-modal-title');
  if (titleEl) titleEl.textContent = 'Edit — ' + (row ? (row.holding_name || 'Gold Holding') : 'Gold Holding');
  if (document.getElementById('ge-name'))     document.getElementById('ge-name').value     = row ? (row.holding_name || '') : '';
  if (document.getElementById('ge-type'))     document.getElementById('ge-type').value     = row ? (row.holding_type || '') : '';
  if (document.getElementById('ge-qty'))      document.getElementById('ge-qty').value      = row ? (row.qty          || '') : '';
  if (document.getElementById('ge-avg-cost')) document.getElementById('ge-avg-cost').value = row ? (row.avg_cost     || '') : '';
  document.getElementById('gold-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGoldEditModal() {
  document.getElementById('gold-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingGoldId = null;
}

// ── Event wiring ──────────────────────────────────────────────

document.addEventListener('fragments-loaded', () => {

  // Refresh button
  document.getElementById('gold-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Gold') loadAssets(_currentUserId, 'Gold');
  });

  // Import modal
  const goldImportModal = document.getElementById('gold-import-modal');
  document.getElementById('gold-import-btn')?.addEventListener('click',        openGoldImportModal);
  document.getElementById('gold-import-close-btn')?.addEventListener('click',  closeGoldImportModal);
  document.getElementById('gold-import-cancel-btn')?.addEventListener('click', closeGoldImportModal);
  goldImportModal?.addEventListener('click', e => { if (e.target === goldImportModal) closeGoldImportModal(); });
  document.getElementById('gold-csv-input')?.addEventListener('change', e => handleGoldCSV(e.target.files[0]));
  document.getElementById('gold-import-confirm-btn')?.addEventListener('click', () => {
    if (_goldPreviewRows.length) importGoldHoldings(_goldPreviewRows);
  });

  // Edit modal
  const goldEditModal = document.getElementById('gold-edit-modal');
  document.getElementById('gold-edit-close-btn')?.addEventListener('click',  closeGoldEditModal);
  document.getElementById('gold-edit-cancel-btn')?.addEventListener('click', closeGoldEditModal);
  goldEditModal?.addEventListener('click', e => { if (e.target === goldEditModal) closeGoldEditModal(); });
  document.getElementById('gold-edit-save-btn')?.addEventListener('click', async () => {
    if (!_editingGoldId) return;
    const qty     = parseFloat(document.getElementById('ge-qty').value);
    const avgCost = parseFloat(document.getElementById('ge-avg-cost').value);
    if (!qty || qty <= 0)         { showToast('Qty must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg Cost must be greater than 0', 'error'); return; }
    const saveBtn = document.getElementById('gold-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
    const { error } = await sb.from('gold_holdings').update({ qty, avg_cost: avgCost }).eq('id', _editingGoldId);
    saveBtn.textContent = '💾 Save Changes'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast('Updated ✅', 'success'); closeGoldEditModal(); loadAssets(_currentUserId, _currentAssetFilter); }
  });

});