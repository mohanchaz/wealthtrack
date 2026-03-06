// ══════════════════════════════════════════════════════════════
//  GOLD — CSV import (GOLDBEES ETF + Gold MF), edit, refresh
// ══════════════════════════════════════════════════════════════

// Yahoo Finance symbols for gold holdings
const GOLD_SYMBOL_MAP = {
  'GOLDBEES':                      'GOLDBEES.NS',   // Gold ETF on NSE
  'Nippon India Gold Savings Fund': '0P0000XVDS.BO', // Gold MF
};

function resolveGoldSymbol(name) {
  if (GOLD_SYMBOL_MAP[name]) return GOLD_SYMBOL_MAP[name];
  // Fuzzy match
  const lower = name.toLowerCase();
  for (const [key, sym] of Object.entries(GOLD_SYMBOL_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return sym;
  }
  return null;
}

// ── Gold Actual Invested ──────────────────────────────────────

let _editingGaiId = null;

async function loadGoldActualInvested(userId) {
  const section = document.getElementById('gold-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('gold-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('gold_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderGoldActualInvested(data || []);
}

function renderGoldActualInvested(rows) {
  const body    = document.getElementById('gold-monthly-body');
  const totalEl = document.getElementById('gold-monthly-total');
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
        <td class="gai-cb-wrap" data-id="${r.id}" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="gai-cb" data-id="${r.id}" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-gai-id="${r.id}" data-gai-date="${r.entry_date}" data-gai-amount="${r.amount}"
          class="gai-edit-btn" title="Edit">✏️</button></span>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;


  if (window['_gold_bindCheckboxes']) window['_gold_bindCheckboxes']();
  body.querySelectorAll('.gai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openGaiModal({
      id: btn.dataset.gaiId, entry_date: btn.dataset.gaiDate,
      amount: btn.dataset.gaiAmount
    }));
  });
}

function openGaiModal(row = null) {
  _editingGaiId = row?.id || null;
  const titleEl = document.getElementById('gold-invested-modal-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  document.getElementById('gai-date').value   = row?.entry_date || '';
  document.getElementById('gai-amount').value = row?.amount    || '';
  document.getElementById('gold-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGaiModal() {
  document.getElementById('gold-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingGaiId = null;
}

document.addEventListener('fragments-loaded', () => {
  document.getElementById('gold-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Gold') loadAssets(_currentUserId, 'Gold');
  });

  const modal = document.getElementById('gold-invested-modal');
  document.getElementById('gold-invested-add-btn')?.addEventListener('click',    () => openGaiModal());
  document.getElementById('gold-invested-close-btn')?.addEventListener('click',  closeGaiModal);
  document.getElementById('gold-invested-cancel-btn')?.addEventListener('click', closeGaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeGaiModal(); });

  document.getElementById('gold-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('gai-date').value;
    const amount = parseFloat(document.getElementById('gai-amount').value);

    if (!date)                  { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('gold-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount };
    let op;
    if (_editingGaiId) {
      op = sb.from('gold_actual_invested').update(payload).eq('id', _editingGaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('gold_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingGaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeGaiModal();
      loadGoldActualInvested(_currentUserId);
    }
  });

});
// ── Gold Live Price Refresh ───────────────────────────────────

async function fetchAndRefreshGoldPrices(assets) {
  const lastUpdateEl = document.getElementById('gold-last-updated');
  const refreshBtn   = document.getElementById('gold-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live prices…';
  if (refreshBtn)   refreshBtn.disabled = true;

  const symbolSet = new Set(assets.map(a => a.yahoo_symbol).filter(Boolean));

  if (!symbolSet.size) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ No symbols mapped';
    if (refreshBtn) refreshBtn.disabled = false;
    return;
  }

  let prices = null;
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent([...symbolSet].join(','))}`);
    if (res.ok) {
      const raw = await res.json();
      if (!raw.error) prices = raw;
    }
  } catch (e) {
    console.warn('[Gold] fetch failed:', e.message);
  }

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    showToast('Price fetch failed', 'error');
    return;
  }

  const getPrice = sym => {
    if (!sym) return null;
    // Try with suffix stripped, then with NS/BO suffix
    const key = sym.replace(/\.(NS|BO)$/, '');
    return getLTP(prices, key);
  };

  let totalValue = 0, totalInvested = 0;

  assets.forEach(a => {
    const price = getPrice(a.yahoo_symbol);
    totalValue    += (+a.qty || 0) * (price || +a.avg_cost || 0);
    totalInvested += (+a.qty || 0) * (+a.avg_cost || 0);
  });

  assets.forEach(a => {
    const price2 = getPrice(a.yahoo_symbol);
    if (!price2) return;

    const qty         = +a.qty || 0;
    const curVal      = qty * price2;
    const investedAmt = qty * (+a.avg_cost || 0);
    const gain        = curVal - investedAmt;
    const gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct    = totalValue > 0 ? ((curVal / totalValue) * 100) : 0;

    const nameKey = a.holding_name;

    const ltpCell = document.querySelector(`[data-live-_ltp="${nameKey}"]`);
    if (ltpCell) ltpCell.textContent = INR(price2);

    const cvCell = document.querySelector(`[data-live-current_value="${nameKey}"]`);
    if (cvCell) cvCell.textContent = INR(curVal);

    const allocCell = document.querySelector(`[data-live-_alloc_pct="${nameKey}"]`);
    if (allocCell) {
      const barWidth = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
          <span style="display:block;height:100%;width:${barWidth}%;background:var(--accent);border-radius:99px"></span>
        <b style="font-size:12px;color:var(--accent)">${allocPct.toFixed(1)}%</b>
      </span>`;
    }

    const gainTd = document.querySelector(`[data-live-gain="${nameKey}"]`);
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


// ── Gold CSV Parse ────────────────────────────────────────────

let _goldPreviewRows = [];

function parseGoldCSV(text) {
  const lines  = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const needles = Array.prototype.slice.call.bind(Array.prototype.slice);

  function find() {
    const args = Array.prototype.slice.call(arguments);
    for (let i = 0; i < args.length; i++) {
      const needle = args[i].toLowerCase();
      const idx = header.findIndex(h => h.toLowerCase().indexOf(needle) !== -1);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const iName     = find('Instrument');
  const iQty      = find('Qty');
  const iAvgCost  = find('Avg. cost', 'Avg cost', 'avg_cost');
  const iInvested = find('Invested');
  const iCurVal   = find('Cur. val', 'Cur val', 'current_value');
  const iPnL      = find('P&L');

  const holdings = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols  = lines[i].split(',');
    const clean = c => (c || '').toString().replace(/^"|"$/g, '').trim();
    const num   = c => parseFloat(clean(c)) || 0;

    const name = clean(cols[iName]);
    if (!name) continue;

    // GOLDBEES = stock (ALL CAPS), Gold MF = mixed case with "gold"
    const isGoldETF = name.toUpperCase() === name && /gold/i.test(name);
    const isGoldMF  = /[a-z]/.test(name) && /gold/i.test(name);

    if (!isGoldETF && !isGoldMF) continue;

    holdings.push({
      holding_name:  name,
      holding_type:  isGoldETF ? 'ETF' : 'MF',
      qty:           num(cols[iQty]),
      avg_cost:      num(cols[iAvgCost]),
      invested:      num(cols[iInvested]),
      current_value: num(cols[iCurVal]),
      pnl:           num(cols[iPnL]),
      yahoo_symbol:  resolveGoldSymbol(name)
    });
  }
  return holdings;
}

// ── Gold Import Modal ─────────────────────────────────────────

function openGoldImportModal() {
  _goldPreviewRows = [];
  document.getElementById('gold-csv-input').value = '';
  document.getElementById('gold-csv-filename').textContent = '';
  document.getElementById('gold-preview-section').classList.add('hidden');
  document.getElementById('gold-import-confirm-btn').classList.add('hidden');
  document.getElementById('gold-import-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGoldImportModal() {
  document.getElementById('gold-import-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function handleGoldCSV(file) {
  if (!file) return;
  document.getElementById('gold-csv-filename').textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    _goldPreviewRows = parseGoldCSV(e.target.result);
    const count = _goldPreviewRows.length;

    document.getElementById('gold-holding-count').textContent  = count;
    document.getElementById('gold-import-count').textContent   = count;

    const thead   = document.getElementById('gold-preview-thead');
    const tbody   = document.getElementById('gold-preview-body');
    const thStyle = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';

    thead.innerHTML = `<tr>
      <th style="${thStyle};text-align:center;width:32px">✓</th>
      <th style="${thStyle};text-align:left">Name</th>
      <th style="${thStyle};text-align:left">Type</th>
      <th style="${thStyle}">Qty / Units</th>
      <th style="${thStyle}">Avg Cost</th>
      <th style="${thStyle}">Invested</th>
      <th style="${thStyle}">Cur. Value</th>
      <th style="${thStyle}">P&amp;L</th>
    </tr>`;

    const tdS = 'padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);font-size:12px';
    tbody.innerHTML = _goldPreviewRows.map((r, i) => {
      const pnlColor  = r.pnl >= 0 ? 'var(--green)' : 'var(--danger)';
      const typeBadge = r.holding_type === 'ETF'
        ? `<span style="background:#fff3cd;color:#856404;padding:1px 7px;border-radius:20px;font-size:11px;font-weight:600">ETF</span>`
        : `<span style="background:var(--accentbg);color:var(--accent);padding:1px 7px;border-radius:20px;font-size:11px;font-weight:600">MF</span>`;
      const symBadge = r.yahoo_symbol
        ? `<span style="font-size:10px;color:var(--muted2);margin-left:4px">${r.yahoo_symbol}</span>`
        : `<span style="font-size:10px;color:var(--danger);margin-left:4px">⚠️ no symbol</span>`;
      return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}" data-idx="${i}">
        <td style="${tdS};text-align:center">
          <input type="checkbox" class="gold-row-chk" data-idx="${i}" checked style="cursor:pointer;width:15px;height:15px">
        </td>
        <td style="${tdS};text-align:left;font-weight:600">${r.holding_name}${symBadge}</td>
        <td style="${tdS};text-align:left">${typeBadge}</td>
        <td style="${tdS}">${r.qty}</td>
        <td style="${tdS}">${INR(r.avg_cost)}</td>
        <td style="${tdS}">${INR(r.invested)}</td>
        <td style="${tdS};font-weight:600">${INR(r.current_value)}</td>
        <td style="${tdS};color:${pnlColor};font-weight:600">${INR(r.pnl)}</td>
      </tr>`;
    }).join('');

    const updateCount = () => {
      const checked = tbody.querySelectorAll('.gold-row-chk:checked').length;
      document.getElementById('gold-import-count').textContent   = checked;
      document.getElementById('gold-holding-count').textContent  = checked;
      const btn = document.getElementById('gold-import-confirm-btn');
      checked > 0 ? btn.classList.remove('hidden') : btn.classList.add('hidden');
    };
    tbody.querySelectorAll('.gold-row-chk').forEach(chk => chk.addEventListener('change', updateCount));

    document.getElementById('gold-preview-section').classList.remove('hidden');
    count > 0
      ? document.getElementById('gold-import-confirm-btn').classList.remove('hidden')
      : document.getElementById('gold-import-confirm-btn').classList.add('hidden');
  };
  reader.readAsText(file);
}

async function importGoldHoldings(allRows) {
  const checkedIdxs = new Set(
    [...document.querySelectorAll('.gold-row-chk:checked')].map(c => +c.dataset.idx)
  );
  const rows = allRows.filter((_, i) => checkedIdxs.has(i));
  if (!rows.length) { showToast('No holdings selected', 'error'); return; }

  const confirmBtn = document.getElementById('gold-import-confirm-btn');
  confirmBtn.textContent = 'Importing…'; confirmBtn.disabled = true;

  // Delete all then insert fresh
  await sb.from('gold_holdings').delete().eq('user_id', _currentUserId);

  const payload2 = rows.map(r => ({
    user_id:      _currentUserId,
    holding_name: r.holding_name,
    holding_type: r.holding_type,
    qty:          r.qty,
    avg_cost:     r.avg_cost,
    yahoo_symbol: r.yahoo_symbol || null,
    imported_at:  new Date().toISOString()
  }));

  const { error } = await sb.from('gold_holdings').insert(payload2);

  confirmBtn.textContent = `📥 Import ${rows.length} Holdings`;
  confirmBtn.disabled = false;

  if (error) {
    showToast('Import failed: ' + error.message, 'error');
  } else {
    showToast(`✅ Imported ${rows.length} gold holdings!`, 'success');
    closeGoldImportModal();
    loadAssets(_currentUserId, 'Gold');
  }
}


  const modal2 = document.getElementById('gold-import-modal');
  document.getElementById('gold-import-btn')?.addEventListener('click', openGoldImportModal);
  document.getElementById('gold-import-close-btn')?.addEventListener('click', closeGoldImportModal);
  document.getElementById('gold-import-cancel-btn')?.addEventListener('click', closeGoldImportModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeGoldImportModal(); });

  document.getElementById('gold-csv-input')?.addEventListener('change', e => {
    handleGoldCSV(e.target.files[0]);
  });

  document.getElementById('gold-import-confirm-btn')?.addEventListener('click', () => {
    if (_goldPreviewRows.length) importGoldHoldings(_goldPreviewRows);
  });

// ── Gold Edit Modal ───────────────────────────────────────────

let _editingGoldId = null;
let _editingGoldCurrentQty = null;

function openGoldEditModal(row) {
  _editingGoldId         = row?.id   || null;
  _editingGoldCurrentQty = +row?.qty || 0;

  document.getElementById('gold-edit-modal-title').textContent = `Edit — ${row.holding_name}`;
  document.getElementById('ge-name').value     = row?.holding_name ?? '';
  document.getElementById('ge-type').value     = row?.holding_type ?? '';
  document.getElementById('ge-qty').value      = row?.qty          ?? '';
  document.getElementById('ge-avg-cost').value = row?.avg_cost     ?? '';

  document.getElementById('gold-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGoldEditModal() {
  document.getElementById('gold-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingGoldId = null;
}


  document.getElementById('gold-edit-close-btn')?.addEventListener('click', closeGoldEditModal);
  document.getElementById('gold-edit-cancel-btn')?.addEventListener('click', closeGoldEditModal);
  document.getElementById('gold-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('gold-edit-modal')) closeGoldEditModal();
  });

  document.getElementById('gold-edit-save-btn')?.addEventListener('click', async () => {
    const qty     = parseFloat(document.getElementById('ge-qty').value);
    const avgCost = parseFloat(document.getElementById('ge-avg-cost').value);

    if (!qty || qty <= 0)         { showToast('Qty must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg Cost must be greater than 0', 'error'); return; }

    const saveBtn2 = document.getElementById('gold-edit-save-btn');
    saveBtn2.textContent = 'Saving…'; saveBtn2.disabled = true;

    const { error } = await sb.from('gold_holdings').update({ qty, avg_cost: avgCost }).eq('id', _editingGoldId);

    saveBtn2.textContent = '💾 Save Changes'; saveBtn2.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast('Updated ✅', 'success');
      closeGoldEditModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });




});
// ── Actual Invested bulk-select wiring for gold ─────────────────
(function() {
  var _sel = false;
  var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function _enter() {
    _sel = true;
    var btn = document.getElementById('gold-select-btn');
    if (btn) { btn.innerHTML = '\u2715 Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
    document.getElementById('gold-bulk-bar')?.classList.remove('hidden');
    document.querySelectorAll('.gai-cb-wrap').forEach(function(c) { c.style.display = ''; });
    _upd();
  }

  function _exit() {
    _sel = false;
    var btn = document.getElementById('gold-select-btn');
    if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
    document.getElementById('gold-bulk-bar')?.classList.add('hidden');
    document.getElementById('gold-bulk-normal').style.display = 'flex';
    document.getElementById('gold-bulk-confirm').style.display = 'none';
    document.querySelectorAll('.gai-cb-wrap').forEach(function(c) { c.style.display = 'none'; });
    document.querySelectorAll('.gai-cb').forEach(function(c) { c.checked = false; });
    _upd();
  }

  function _upd() {
    var n = document.querySelectorAll('.gai-cb:checked').length;
    var countEl = document.getElementById('gold-bulk-count');
    var delBtn = document.getElementById('gold-bulk-delete');
    if (countEl) countEl.textContent = n + ' selected';
    if (delBtn) delBtn.disabled = n === 0;
  }


    document.getElementById('gold-select-btn')?.addEventListener('click', function() {
      if (_sel) _exit(); else _enter();
    });
    document.getElementById('gold-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('gold-bulk-delete')?.addEventListener('click', function() {
      var n = document.querySelectorAll('.gai-cb:checked').length;
      if (!n) return;
      document.getElementById('gold-bulk-normal').style.display = 'none';
      document.getElementById('gold-bulk-confirm').style.display = 'flex';
      document.getElementById('gold-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('gold-bulk-no')?.addEventListener('click', function() {
      document.getElementById('gold-bulk-normal').style.display = 'flex';
      document.getElementById('gold-bulk-confirm').style.display = 'none';
    });

    document.getElementById('gold-bulk-yes')?.addEventListener('click', async function() {
      var checked = [...document.querySelectorAll('.gai-cb:checked')];
      if (!checked.length) return;
      var yesBtn = document.getElementById('gold-bulk-yes');
      yesBtn.textContent = 'Deleting\u2026'; yesBtn.disabled = true;
      var anyErr = false;
      for (var cb of checked) {
        var r = await sb.from('gold_actual_invested').delete().eq('id', cb.dataset.id);
        if (r.error) { showToast('Delete failed: ' + r.error.message, 'error'); anyErr = true; }
      }
      yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
      if (!anyErr) showToast(checked.length + ' ' + (checked.length === 1 ? 'entry' : 'entries') + ' deleted', 'success');
      _exit();
      loadGoldActualInvested(_currentUserId);
    });


  // Called after each render to re-wire checkboxes
  window['_gold_bindCheckboxes'] = function() {
    document.querySelectorAll('.gai-cb').forEach(function(cb) {
      cb.addEventListener('change', _upd);
    });
    // Hide all checkbox cells by default unless in select mode
    document.querySelectorAll('.gai-cb-wrap').forEach(function(c) {
      c.style.display = _sel ? '' : 'none';
    });
    if (_sel) _upd();
  };
})();