// ══════════════════════════════════════════════════════════════
//  AIONION ACTUAL INVESTED  — manual entries from aionion_actual_invested
// ══════════════════════════════════════════════════════════════

let _editingAaiId = null;

async function loadAionionActualInvested(userId) {
  const section = document.getElementById('aionion-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('aionion-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('aionion_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderAionionActualInvested(data || []);
}

function renderAionionActualInvested(rows) {
  const body    = document.getElementById('aionion-monthly-body');
  const totalEl = document.getElementById('aionion-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${INR(grand)}`;

  const statTile = document.getElementById('assets-actual-invested');
  if (statTile) statTile.textContent = INR(grand);

  const curValEl = document.getElementById('assets-total-value');
  const currentValue = curValEl ? parseFloat(curValEl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  const actualGain = currentValue - grand;
  const gainPct = grand > 0 ? ` (${((actualGain / grand) * 100).toFixed(1)}%)` : '';
  const gainColor = actualGain > 0 ? 'var(--green)' : actualGain < 0 ? 'var(--danger)' : 'var(--muted)';
  const gainLabel = (actualGain >= 0 ? '+' : '') + INR(actualGain) + gainPct;
  const gainTile = document.getElementById('assets-actual-gain');
  if (gainTile) { gainTile.textContent = gainLabel; gainTile.style.color = gainColor; }

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="3" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
        <td class="aai-cb-wrap" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="aai-cb" data-id="${r.id}" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-aai-id="${r.id}" data-aai-date="${r.entry_date}" data-aai-amount="${r.amount}"
          class="aai-edit-btn" title="Edit">✏️</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  if (window['_aionion_bindCheckboxes']) window['_aionion_bindCheckboxes']();
  body.querySelectorAll('.aai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openAaiModal({
      id: btn.dataset.aaiId, entry_date: btn.dataset.aaiDate, amount: btn.dataset.aaiAmount
    }));
  });
}

function openAaiModal(row = null) {
  _editingAaiId = row?.id || null;
  const titleEl = document.getElementById('aionion-invested-modal-title');
  const saveBtn = document.getElementById('aionion-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '💾 Save Entry';
  document.getElementById('aai-date').value   = row?.entry_date || '';
  document.getElementById('aai-amount').value = row?.amount    || '';
  document.getElementById('aionion-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAaiModal() {
  document.getElementById('aionion-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAaiId = null;
}

// ══════════════════════════════════════════════════════════════
//  AIONION LIVE PRICE REFRESH
// ══════════════════════════════════════════════════════════════

async function fetchAndRefreshAionionPrices(assets) {
  const lastUpdateEl = document.getElementById('aionion-last-updated');
  const refreshBtn   = document.getElementById('aionion-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live prices…';
  if (refreshBtn)   refreshBtn.disabled = true;

  const instruments = assets.map(a => a.instrument);
  const prices = await fetchLivePrices(instruments);

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    showToast('Live price fetch failed — check console', 'error');
    return;
  }

  let totalValue = 0, totalInvested = 0;

  assets.forEach(a => {
    const ltp = getLTP(prices, a.instrument);
    totalValue    += (+a.qty || 0) * (ltp || +a.avg_cost || 0);
    totalInvested += (+a.qty || 0) * (+a.avg_cost || 0);
  });

  assets.forEach(a => {
    const ltp = getLTP(prices, a.instrument);
    if (!ltp) return;

    const name        = getCompanyName(prices, a.instrument);
    const qty         = +a.qty || 0;
    const curVal      = qty * ltp;
    const investedAmt = qty * (+a.avg_cost || 0);
    const gain        = curVal - investedAmt;
    const gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct    = totalValue > 0 ? ((curVal / totalValue) * 100) : 0;

    const nameCell = document.querySelector(`[data-live-_name="${a.instrument}"]`);
    if (nameCell && name) nameCell.innerHTML = `<span style="color:var(--muted);font-size:12px">${name}</span>`;

    const ltpCell = document.querySelector(`[data-live-_ltp="${a.instrument}"]`);
    if (ltpCell) ltpCell.textContent = INR(ltp);

    const cvCell = document.querySelector(`[data-live-current_value="${a.instrument}"]`);
    if (cvCell) cvCell.textContent = INR(curVal);

    const allocCell = document.querySelector(`[data-live-_alloc_pct="${a.instrument}"]`);
    if (allocCell) {
      const barWidth = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
          <span style="display:block;height:100%;width:${barWidth}%;background:var(--accent);border-radius:99px"></span>
        </span>
        <b style="font-size:12px;color:var(--accent)">${allocPct.toFixed(1)}%</b>
      </span>`;
    }

    const gainTd = document.querySelector(`[data-live-gain="${a.instrument}"]`);
    if (gainTd) {
      const arrow    = gain >= 0 ? '▲' : '▼';
      const badgeCls = gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'zero';
      gainTd.innerHTML = `<span class="gain-badge ${badgeCls}">${arrow} ${INR(Math.abs(gain))}${gainPct ? ` (${gainPct}%)` : ''}</span>`;
    }
  });

  const totalGain    = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? ` (${((totalGain / totalInvested) * 100).toFixed(1)}%)` : '';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('assets-total-value',    INR(totalValue));
  set('assets-total-invested', INR(totalInvested));
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + totalGainPct;
    gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpdateEl) lastUpdateEl.textContent = `🟢 Live · ${now}`;
}

// ══════════════════════════════════════════════════════════════
//  AIONION STOCKS  — CSV import module
// ══════════════════════════════════════════════════════════════

let _aionionPreviewRows = [];

function parseAionionCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const find = (...names) => {
    for (const name of names) {
      const idx = header.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iInstrument = find('Instrument');
  const iQty        = find('Qty');
  const iAvgCost    = find('Avg. cost', 'Avg cost', 'avg_cost');
  const iInvested   = find('Invested');
  const iCurVal     = find('Cur. val', 'Cur val', 'current_value');
  const iPnL        = find('P&L', 'P&amp;L');
  const iNetChg     = find('Net chg');
  const iDayChg     = find('Day chg');

  const stocks = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols  = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || lines[i].split(',');
    const clean = c => (c || '').toString().replace(/^"|"$/g, '').trim();
    const num   = c => parseFloat(clean(c)) || 0;

    const instrument = clean(cols[iInstrument]);
    if (!instrument) continue;
    if (!/^[A-Z0-9\-\.&]+$/.test(instrument)) continue;
    if (/gold/i.test(instrument)) continue;

    stocks.push({
      instrument,
      qty:           num(cols[iQty]),
      avg_cost:      num(cols[iAvgCost]),
      invested:      num(cols[iInvested]),
      current_value: num(cols[iCurVal]),
      pnl:           num(cols[iPnL]),
      net_chg:       num(cols[iNetChg]),
      day_chg:       num(cols[iDayChg]),
    });
  }
  return stocks;
}

function openAionionImportModal() {
  _aionionPreviewRows = [];
  document.getElementById('aionion-csv-input').value = '';
  document.getElementById('aionion-csv-filename').textContent = '';
  document.getElementById('aionion-preview-section').classList.add('hidden');
  document.getElementById('aionion-import-confirm-btn').classList.add('hidden');
  document.getElementById('aionion-import-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAionionImportModal() {
  document.getElementById('aionion-import-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function handleAionionCSV(file) {
  if (!file) return;
  document.getElementById('aionion-csv-filename').textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    _aionionPreviewRows = parseAionionCSV(e.target.result);
    const count = _aionionPreviewRows.length;

    document.getElementById('aionion-stock-count').textContent  = count;
    document.getElementById('aionion-import-count').textContent = count;

    const thead   = document.getElementById('aionion-preview-thead');
    const tbody   = document.getElementById('aionion-preview-body');
    const thStyle = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';
    thead.innerHTML = `<tr>
      <th style="${thStyle};text-align:center;width:32px" title="Include in import">✓</th>
      <th style="${thStyle};text-align:left">Instrument</th>
      <th style="${thStyle}">Qty</th>
      <th style="${thStyle}">Avg Cost</th>
      <th style="${thStyle}">Invested</th>
      <th style="${thStyle}">Cur. Value</th>
      <th style="${thStyle}">P&amp;L</th>
    </tr>`;

    const tdS = 'padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);font-size:12px';
    tbody.innerHTML = _aionionPreviewRows.map((r, i) => {
      const pnlColor = r.pnl >= 0 ? 'var(--green)' : 'var(--danger)';
      return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}" data-idx="${i}">
        <td style="${tdS};text-align:center">
          <input type="checkbox" class="aionion-row-chk" data-idx="${i}" checked style="cursor:pointer;width:15px;height:15px">
        </td>
        <td style="${tdS};text-align:left;font-weight:600">${r.instrument}</td>
        <td style="${tdS}">${r.qty}</td>
        <td style="${tdS}">${INR(r.avg_cost)}</td>
        <td style="${tdS}">${INR(r.invested)}</td>
        <td style="${tdS};font-weight:600">${INR(r.current_value)}</td>
        <td style="${tdS};color:${pnlColor};font-weight:600">${INR(r.pnl)}</td>
      </tr>`;
    }).join('');

    const updateCount = () => {
      const checked = tbody.querySelectorAll('.aionion-row-chk:checked').length;
      document.getElementById('aionion-import-count').textContent = checked;
      document.getElementById('aionion-stock-count').textContent  = checked;
      const btn = document.getElementById('aionion-import-confirm-btn');
      if (checked > 0) btn.classList.remove('hidden'); else btn.classList.add('hidden');
    };
    tbody.querySelectorAll('.aionion-row-chk').forEach(chk => chk.addEventListener('change', updateCount));

    document.getElementById('aionion-preview-section').classList.remove('hidden');
    if (count > 0) document.getElementById('aionion-import-confirm-btn').classList.remove('hidden');
    else           document.getElementById('aionion-import-confirm-btn').classList.add('hidden');
  };
  reader.readAsText(file);
}

async function importAionionStocks(allRows) {
  const checkedIdxs = new Set(
    [...document.querySelectorAll('.aionion-row-chk:checked')].map(c => +c.dataset.idx)
  );
  const rows = allRows.filter((_, i) => checkedIdxs.has(i));
  if (!rows.length) { showToast('No stocks selected', 'error'); return; }

  const confirmBtn = document.getElementById('aionion-import-confirm-btn');
  confirmBtn.textContent = 'Importing…';
  confirmBtn.disabled    = true;

  const { data: existing } = await sb.from('aionion_stocks').select('instrument, qty').eq('user_id', _currentUserId);
  const prevQtyMap = {};
  (existing || []).forEach(r => { prevQtyMap[r.instrument] = +r.qty || 0; });

  const incomingSet = new Set(rows.map(r => r.instrument));
  const toDelete    = (existing || []).filter(r => !incomingSet.has(r.instrument)).map(r => r.instrument);
  if (toDelete.length) {
    await sb.from('aionion_stocks').delete().eq('user_id', _currentUserId).in('instrument', toDelete);
  }

  const { error } = await sb.from('aionion_stocks').upsert(
    rows.map(r => ({
      user_id:     _currentUserId,
      instrument:  r.instrument,
      qty:         r.qty,
      prev_qty:    prevQtyMap[r.instrument] ?? 0,
      avg_cost:    r.avg_cost,
      imported_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,instrument' }
  );

  confirmBtn.textContent = `📥 Import ${rows.length} Stocks`;
  confirmBtn.disabled    = false;

  if (error) {
    showToast('Import failed: ' + error.message, 'error');
  } else {
    showToast(`✅ Imported ${rows.length} stocks successfully!`, 'success');
    closeAionionImportModal();
    loadAssets(_currentUserId, 'Aionion Stocks');
  }
}

// ══════════════════════════════════════════════════════════════
//  AIONION STOCK EDIT MODAL
// ══════════════════════════════════════════════════════════════

let _editingAionionId         = null;
let _editingAionionCurrentQty = null;

function openAionionEditModal(row) {
  const isAdd = !row;
  _editingAionionId         = row?.id   || null;
  _editingAionionCurrentQty = +row?.qty || 0;
  document.getElementById('aionion-edit-modal-title').textContent = isAdd ? 'Add Stock' : `Edit — ${row.instrument}`;
  const instrEl    = document.getElementById('ae-instrument');
  instrEl.value    = row?.instrument ?? '';
  instrEl.readOnly = !isAdd;
  instrEl.style.background = isAdd ? '' : 'var(--surface2)';
  instrEl.style.color      = isAdd ? '' : 'var(--muted)';
  instrEl.style.cursor     = isAdd ? '' : 'not-allowed';
  document.getElementById('ae-qty').value      = row?.qty      ?? '';
  document.getElementById('ae-avg-cost').value = row?.avg_cost ?? '';
  const saveBtn = document.getElementById('aionion-edit-save-btn');
  if (saveBtn) saveBtn.textContent = isAdd ? '💾 Add Stock' : '💾 Save Changes';
  document.getElementById('aionion-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAionionEditModal() {
  document.getElementById('aionion-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAionionId = null;
}

// ══════════════════════════════════════════════════════════════
//  EVENT WIRING  (all inside fragments-loaded)
// ══════════════════════════════════════════════════════════════

document.addEventListener('fragments-loaded', () => {

  // ── Actual Invested modal ──────────────────────────────────
  const modal = document.getElementById('aionion-invested-modal');
  document.getElementById('aionion-invested-add-btn')?.addEventListener('click',    () => openAaiModal());
  document.getElementById('aionion-invested-close-btn')?.addEventListener('click',  closeAaiModal);
  document.getElementById('aionion-invested-cancel-btn')?.addEventListener('click', closeAaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeAaiModal(); });

  document.getElementById('aionion-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('aai-date').value;
    const amount = parseFloat(document.getElementById('aai-amount').value);
    if (!date)              { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount };
    let op;
    if (_editingAaiId) {
      op = sb.from('aionion_actual_invested').update(payload).eq('id', _editingAaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('aionion_actual_invested').insert(payload);
    }
    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;
    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingAaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeAaiModal();
      loadAionionActualInvested(_currentUserId);
    }
  });

  // ── Refresh button ──────────────────────────────────────────
  document.getElementById('aionion-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Aionion Stocks') loadAssets(_currentUserId, 'Aionion Stocks');
  });

  // ── Import modal ────────────────────────────────────────────
  const modal2 = document.getElementById('aionion-import-modal');
  document.getElementById('aionion-import-btn')?.addEventListener('click',        openAionionImportModal);
  document.getElementById('aionion-import-close-btn')?.addEventListener('click',  closeAionionImportModal);
  document.getElementById('aionion-import-cancel-btn')?.addEventListener('click', closeAionionImportModal);
  modal2?.addEventListener('click', e => { if (e.target === modal2) closeAionionImportModal(); });

  document.getElementById('aionion-csv-input')?.addEventListener('change', e => {
    handleAionionCSV(e.target.files[0]);
  });
  document.getElementById('aionion-import-confirm-btn')?.addEventListener('click', () => {
    if (_aionionPreviewRows.length) importAionionStocks(_aionionPreviewRows);
  });

  // ── Edit modal ──────────────────────────────────────────────
  const modal3 = document.getElementById('aionion-edit-modal');
  document.getElementById('aionion-edit-close-btn')?.addEventListener('click',  closeAionionEditModal);
  document.getElementById('aionion-edit-cancel-btn')?.addEventListener('click', closeAionionEditModal);
  modal3?.addEventListener('click', e => { if (e.target === modal3) closeAionionEditModal(); });

  document.getElementById('aionion-edit-save-btn')?.addEventListener('click', async () => {
    const isAddMode  = !_editingAionionId;
    const instrument = document.getElementById('ae-instrument').value.trim().toUpperCase();
    if (isAddMode && !instrument) { showToast('Instrument symbol is required', 'error'); return; }

    const qty     = parseFloat(document.getElementById('ae-qty').value);
    const avgCost = parseFloat(document.getElementById('ae-avg-cost').value);
    if (!qty || qty <= 0)         { showToast('Quantity must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg Cost must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    let error;
    if (isAddMode) {
      ({ error } = await sb.from('aionion_stocks').insert({
        user_id: _currentUserId, instrument, qty, prev_qty: 0, avg_cost: avgCost,
      }));
    } else {
      const payload = { qty, avg_cost: avgCost };
      if (qty !== _editingAionionCurrentQty) payload.prev_qty = _editingAionionCurrentQty;
      ({ error } = await sb.from('aionion_stocks').update(payload).eq('id', _editingAionionId));
    }

    saveBtn.textContent = isAddMode ? '💾 Add Stock' : '💾 Save Changes';
    saveBtn.disabled    = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(isAddMode ? 'Stock added 🎉' : 'Stock updated ✅', 'success');
      closeAionionEditModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });

  // ── Bulk-select for Actual Invested ────────────────────────
  (function() {
    var _sel = false;
    var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function _enter() {
      _sel = true;
      var btn = document.getElementById('aionion-select-btn');
      if (btn) { btn.innerHTML = '✕ Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
      document.getElementById('aionion-bulk-bar')?.classList.remove('hidden');
      document.querySelectorAll('.aai-cb-wrap').forEach(c => { c.style.display = ''; });
      _upd();
    }

    function _exit() {
      _sel = false;
      var btn = document.getElementById('aionion-select-btn');
      if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
      document.getElementById('aionion-bulk-bar')?.classList.add('hidden');
      document.getElementById('aionion-bulk-normal').style.display = 'flex';
      document.getElementById('aionion-bulk-confirm').style.display = 'none';
      document.querySelectorAll('.aai-cb-wrap').forEach(c => { c.style.display = 'none'; });
      document.querySelectorAll('.aai-cb').forEach(c => { c.checked = false; });
      _upd();
    }

    function _upd() {
      var n       = document.querySelectorAll('.aai-cb:checked').length;
      var countEl = document.getElementById('aionion-bulk-count');
      var delBtn  = document.getElementById('aionion-bulk-delete');
      if (countEl) countEl.textContent = n + ' selected';
      if (delBtn)  delBtn.disabled = n === 0;
    }

    document.getElementById('aionion-select-btn')?.addEventListener('click', () => { if (_sel) _exit(); else _enter(); });
    document.getElementById('aionion-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('aionion-bulk-delete')?.addEventListener('click', () => {
      var n = document.querySelectorAll('.aai-cb:checked').length;
      if (!n) return;
      document.getElementById('aionion-bulk-normal').style.display = 'none';
      document.getElementById('aionion-bulk-confirm').style.display = 'flex';
      document.getElementById('aionion-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('aionion-bulk-no')?.addEventListener('click', () => {
      document.getElementById('aionion-bulk-normal').style.display = 'flex';
      document.getElementById('aionion-bulk-confirm').style.display = 'none';
    });

    document.getElementById('aionion-bulk-yes')?.addEventListener('click', async () => {
      var checked = [...document.querySelectorAll('.aai-cb:checked')];
      if (!checked.length) return;
      var yesBtn = document.getElementById('aionion-bulk-yes');
      yesBtn.textContent = 'Deleting…'; yesBtn.disabled = true;
      var anyErr = false;
      for (var cb of checked) {
        var r = await sb.from('aionion_actual_invested').delete().eq('id', cb.dataset.id);
        if (r.error) { showToast('Delete failed: ' + r.error.message, 'error'); anyErr = true; }
      }
      yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
      if (!anyErr) showToast(checked.length + ' ' + (checked.length === 1 ? 'entry' : 'entries') + ' deleted', 'success');
      _exit();
      loadAionionActualInvested(_currentUserId);
    });

    window['_aionion_bindCheckboxes'] = function() {
      document.querySelectorAll('.aai-cb').forEach(cb => { cb.addEventListener('change', _upd); });
      document.querySelectorAll('.aai-cb-wrap').forEach(c => { c.style.display = _sel ? '' : 'none'; });
      if (_sel) _upd();
    };
  })();

});