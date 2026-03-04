//  AIONION ACTUAL INVESTED  — manual entries from aionion_actual_invested
// ══════════════════════════════════════════════════════════════

let _editingAaiId = null;

async function loadAionionActualInvested(userId) {
  const section = document.getElementById('aionion-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('aionion-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('aionion_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
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

  // Also update the stat tile on the assets page
  const statTile = document.getElementById('assets-actual-invested');
  if (statTile) statTile.textContent = INR(grand);

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>
      <td style="padding:9px 14px;color:var(--muted2);font-size:12px;border-bottom:1px solid var(--border)">${r.notes || ''}</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-zai-id="${r.id}" data-aai-date="${r.entry_date}" data-aai-amount="${r.amount}" data-aai-notes="${r.notes || ''}"
          class="zai-edit-btn" title="Edit">✏️</button>
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-zai-id="${r.id}" class="zai-delete-btn" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  body.querySelectorAll('.zai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openAaiModal({
      id: btn.dataset.zaiId, entry_date: btn.dataset.zaiDate,
      amount: btn.dataset.zaiAmount, notes: btn.dataset.zaiNotes
    }));
  });
  body.querySelectorAll('.zai-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      const { error } = await sb.from('aionion_actual_invested').delete().eq('id', btn.dataset.zaiId);
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
      showToast('Entry deleted', 'success');
      loadAionionActualInvested(_currentUserId);
    });
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
  document.getElementById('aai-notes').value  = row?.notes     || '';
  document.getElementById('aionion-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAaiModal() {
  document.getElementById('aionion-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAaiId = null;
}

// Wire up Aionion actual invested modal events
document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('aionion-invested-modal');
  document.getElementById('aionion-invested-add-btn')?.addEventListener('click',    () => openAaiModal());
  document.getElementById('aionion-invested-close-btn')?.addEventListener('click',  closeAaiModal);
  document.getElementById('aionion-invested-cancel-btn')?.addEventListener('click', closeAaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeAaiModal(); });

  document.getElementById('aionion-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('aai-date').value;
    const amount = parseFloat(document.getElementById('aai-amount').value);
    const notes  = document.getElementById('aai-notes').value.trim() || null;

    if (!date)              { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount, notes };
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
});


// ══════════════════════════════════════════════════════════════

/**
 * Fetch live NSE prices via our own Cloudflare Pages Function (/api/prices).
 * Server-side fetch means no CORS issues whatsoever.
 * Returns { INSTRUMENT: price } map, or null on failure.
 */
async function fetchLivePrices(instruments) {
  const symbols = instruments.map(i => i + '.NS').join(',');
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const priceMap = await res.json();
    if (priceMap.error) throw new Error(priceMap.error);
    console.log('[LivePrices] received:', priceMap);
    return Object.keys(priceMap).length > 0 ? priceMap : null;
  } catch (err) {
    console.warn('[LivePrices] fetch failed:', err.message);
    return null;
  }
}

async function fetchAndRefreshAionionPrices(assets) {
  const lastUpdateEl = document.getElementById('aionion-last-updated');
  const refreshBtn = document.getElementById('aionion-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live prices…';
  if (refreshBtn) refreshBtn.disabled = true;

  const instruments = assets.map(a => a.instrument);
  const prices = await fetchLivePrices(instruments);

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    showToast('Live price fetch failed — check console', 'error');
    return;
  }

  let totalValue = 0, totalInvested = 0;

  // First pass — accumulate totals
  assets.forEach(a => {
    const ltp = prices[a.instrument];
    if (!ltp) return;
    totalValue   += (+a.qty || 0) * ltp;
    totalInvested += (+a.qty || 0) * (+a.avg_cost || 0);
  });

  // Second pass — update each row's cells
  assets.forEach(a => {
    const ltp = prices[a.instrument];
    if (!ltp) return;

    const qty = +a.qty || 0;
    const curVal = qty * ltp;
    const investedAmt = qty * (+a.avg_cost || 0);   // correct: qty × avg_cost
    const pnl = curVal - investedAmt;
    const gain = pnl;
    const gainPct = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct = totalValue > 0 ? ((curVal / totalValue) * 100) : 0;

    // LTP cell
    const ltpCell = document.querySelector(`[data-live-ltp="${a.instrument}"]`);
    if (ltpCell) ltpCell.textContent = INR(ltp);

    // Current value cell
    const cvCell = document.querySelector(`[data-live-current_value="${a.instrument}"]`);
    if (cvCell) cvCell.textContent = INR(curVal);

    // Allocation % cell
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

    // Gain/Loss badge
    const gainTd = document.querySelector(`[data-live-gain="${a.instrument}"]`);
    if (gainTd) {
      const arrow = gain >= 0 ? '▲' : '▼';
      const badgeCls = gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'zero';
      gainTd.innerHTML = `<span class="gain-badge ${badgeCls}">${arrow} ${INR(Math.abs(gain))}${gainPct ? ` (${gainPct}%)` : ''}</span>`;
    }
  });

  // Update stat cards with live totals
  const totalGain = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? ` (${((totalGain / totalInvested) * 100).toFixed(1)}%)` : '';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('assets-total-value', INR(totalValue));
  set('assets-total-invested', INR(totalInvested));
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + totalGainPct;
    gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  // Timestamp
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpdateEl) lastUpdateEl.textContent = `🟢 Live · ${now}`;

  // ── Persist updated LTP to DB so the Assets overview always shows fresh gain/loss ──
  const ltpUpdates = assets
    .filter(a => prices[a.instrument])
    .map(a => ({
      user_id: _currentUserId,
      instrument: a.instrument,
      qty: a.qty,
      prev_qty: a.prev_qty ?? 0,
      avg_cost: a.avg_cost,
      ltp: prices[a.instrument],
    }));
  if (ltpUpdates.length) {
    sb.from('aionion_stocks')
      .upsert(ltpUpdates, { onConflict: 'user_id,instrument' })
      .then(({ error }) => {
        if (error) console.warn('LTP persist failed:', error.message);
      });
  }
}

// Wire Refresh button
document.addEventListener('fragments-loaded', () => {
  document.getElementById('aionion-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Aionion Stocks') {
      loadAssets(_currentUserId, 'Aionion Stocks');
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  AIONION STOCKS  — CSV import module
// ══════════════════════════════════════════════════════════════

let _aionionPreviewRows = [];

/**
 * Parse a Aionion Holdings CSV text.
 * Columns expected: Instrument, Qty., Avg. cost, LTP, Invested, Cur. val, P&L, Net chg., Day chg.
 * Stocks: instrument name is entirely uppercase letters/digits/hyphens.
 */
function parseAionionCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const idxMap = {};
  const find = (...names) => {
    for (const name of names) {
      const idx = header.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iInstrument = find('Instrument');
  const iQty = find('Qty');
  const iAvgCost = find('Avg. cost', 'Avg cost', 'avg_cost');
  const iLTP = find('LTP');
  const iInvested = find('Invested');
  const iCurVal = find('Cur. val', 'Cur val', 'current_value');
  const iPnL = find('P&L', 'P&amp;L');
  const iNetChg = find('Net chg');
  const iDayChg = find('Day chg');

  const stocks = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Handle quoted CSV fields
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g)
      || lines[i].split(',');
    const clean = c => (c || '').toString().replace(/^"|"$/g, '').trim();
    const num = c => parseFloat(clean(c)) || 0;

    const instrument = clean(cols[iInstrument]);
    if (!instrument) continue;

    // Stock detection: name is ALL CAPS (letters, digits, hyphen, dot only)
    const isStock = /^[A-Z0-9\-\.&]+$/.test(instrument);
    if (!isStock) continue;

    // Skip Gold instruments (e.g. GOLDBEES, SGBMAR27, AXISGOLD)
    if (/gold/i.test(instrument)) continue;

    stocks.push({
      instrument,
      qty: num(cols[iQty]),
      avg_cost: num(cols[iAvgCost]),
      ltp: num(cols[iLTP]),
      invested: num(cols[iInvested]),
      current_value: num(cols[iCurVal]),
      pnl: num(cols[iPnL]),
      net_chg: num(cols[iNetChg]),
      day_chg: num(cols[iDayChg]),
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

    document.getElementById('aionion-stock-count').textContent = count;
    document.getElementById('aionion-import-count').textContent = count;

    // Render preview table with per-row exclude checkboxes
    const thead = document.getElementById('aionion-preview-thead');
    const tbody = document.getElementById('aionion-preview-body');
    const thStyle = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';
    thead.innerHTML = `<tr>
      <th style="${thStyle};text-align:center;width:32px" title="Include in import">✓</th>
      <th style="${thStyle};text-align:left">Instrument</th>
      <th style="${thStyle}">Qty</th>
      <th style="${thStyle}">Avg Cost</th>
      <th style="${thStyle}">LTP</th>
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
        <td style="${tdS}">${INR(r.ltp)}</td>
        <td style="${tdS}">${INR(r.invested)}</td>
        <td style="${tdS};font-weight:600">${INR(r.current_value)}</td>
        <td style="${tdS};color:${pnlColor};font-weight:600">${INR(r.pnl)}</td>
      </tr>`;
    }).join('');

    // Live count update when checkboxes change
    const updateCount = () => {
      const checked = tbody.querySelectorAll('.aionion-row-chk:checked').length;
      document.getElementById('aionion-import-count').textContent = checked;
      document.getElementById('aionion-stock-count').textContent = checked;
      const btn = document.getElementById('aionion-import-confirm-btn');
      if (checked > 0) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    };
    tbody.querySelectorAll('.aionion-row-chk').forEach(chk => chk.addEventListener('change', updateCount));

    document.getElementById('aionion-preview-section').classList.remove('hidden');
    if (count > 0) document.getElementById('aionion-import-confirm-btn').classList.remove('hidden');
    else document.getElementById('aionion-import-confirm-btn').classList.add('hidden');
  };
  reader.readAsText(file);
}

async function importAionionStocks(allRows) {
  // Only import rows whose checkbox is still checked in the preview table
  const checkedIdxs = new Set(
    [...document.querySelectorAll('.aionion-row-chk:checked')].map(c => +c.dataset.idx)
  );
  const rows = allRows.filter((_, i) => checkedIdxs.has(i));
  if (!rows.length) { showToast('No stocks selected', 'error'); return; }

  const confirmBtn = document.getElementById('aionion-import-confirm-btn');
  confirmBtn.textContent = 'Importing…';
  confirmBtn.disabled = true;

  // Fetch existing to get prev_qty
  const { data: existing } = await sb
    .from('aionion_stocks')
    .select('instrument, qty')
    .eq('user_id', _currentUserId);

  const prevQtyMap = {};
  (existing || []).forEach(r => { prevQtyMap[r.instrument] = +r.qty || 0; });

  // Get set of incoming instruments to detect deletions
  const incomingSet = new Set(rows.map(r => r.instrument));

  // Delete instruments no longer in the CSV (fully sold)
  const toDelete = (existing || []).filter(r => !incomingSet.has(r.instrument)).map(r => r.instrument);
  if (toDelete.length) {
    await sb.from('aionion_stocks').delete().eq('user_id', _currentUserId).in('instrument', toDelete);
  }

  // Upsert each stock with prev_qty
  const payload = rows.map(r => ({
    user_id: _currentUserId,
    instrument: r.instrument,
    qty: r.qty,
    prev_qty: prevQtyMap[r.instrument] ?? 0,
    avg_cost: r.avg_cost,
    ltp: r.ltp,   // snapshot LTP as fallback before live prices load
    imported_at: new Date().toISOString(),
  }));

  const { error } = await sb
    .from('aionion_stocks')
    .upsert(payload, { onConflict: 'user_id,instrument' });

  confirmBtn.textContent = `📥 Import ${rows.length} Stocks`;
  confirmBtn.disabled = false;

  if (error) {
    showToast('Import failed: ' + error.message, 'error');
  } else {
    showToast(`✅ Imported ${rows.length} stocks successfully!`, 'success');
    closeAionionImportModal();
    loadAssets(_currentUserId, 'Aionion Stocks');
  }
}

// Wire Aionion import modal events
document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('aionion-import-modal');
  document.getElementById('aionion-import-btn')?.addEventListener('click', openAionionImportModal);
  document.getElementById('aionion-import-close-btn')?.addEventListener('click', closeAionionImportModal);
  document.getElementById('aionion-import-cancel-btn')?.addEventListener('click', closeAionionImportModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeAionionImportModal(); });

  document.getElementById('aionion-csv-input')?.addEventListener('change', e => {
    handleAionionCSV(e.target.files[0]);
  });

  document.getElementById('aionion-import-confirm-btn')?.addEventListener('click', () => {
    if (_aionionPreviewRows.length) importAionionStocks(_aionionPreviewRows);
  });
});


//  AIONION STOCK EDIT MODAL
// ══════════════════════════════════════════════════════════════

let _editingAionionId = null;
let _editingAionionCurrentQty = null;  // tracks old qty so prev_qty stays meaningful

function openAionionEditModal(row) {
  _editingAionionId = row.id;
  _editingAionionCurrentQty = +row.qty || 0;  // remember current qty as the "before" value
  document.getElementById('aionion-edit-modal-title').textContent = `Edit — ${row.instrument}`;
  document.getElementById('ae-instrument').value = row.instrument ?? '';
  document.getElementById('ae-qty').value        = row.qty       ?? '';
  document.getElementById('ae-avg-cost').value   = row.avg_cost  ?? '';
  document.getElementById('ae-ltp').value        = row.ltp       ?? '';
  document.getElementById('aionion-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAionionEditModal() {
  document.getElementById('aionion-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAionionId = null;
}

document.addEventListener('fragments-loaded', () => {
  document.getElementById('aionion-edit-close-btn')?.addEventListener('click', closeAionionEditModal);
  document.getElementById('aionion-edit-cancel-btn')?.addEventListener('click', closeAionionEditModal);
  document.getElementById('aionion-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('aionion-edit-modal')) closeAionionEditModal();
  });

  document.getElementById('aionion-edit-save-btn')?.addEventListener('click', async () => {
    if (!_editingAionionId) return;

    const qty     = parseFloat(document.getElementById('ae-qty').value);
    const avgCost = parseFloat(document.getElementById('ae-avg-cost').value);
    const ltp     = parseFloat(document.getElementById('ae-ltp').value);

    if (!qty || qty <= 0)         { showToast('Quantity must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg Cost must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-edit-save-btn');
    saveBtn.textContent = 'Saving\u2026'; saveBtn.disabled = true;

    // If qty changed, shift current qty into prev_qty so the Qty Diff column reflects this edit
    const updatePayload = { qty, avg_cost: avgCost, ltp: ltp || null };
    if (qty !== _editingAionionCurrentQty) {
      updatePayload.prev_qty = _editingAionionCurrentQty;
    }

    const { error } = await sb.from('aionion_stocks')
      .update(updatePayload)
      .eq('id', _editingAionionId);

    saveBtn.textContent = '\uD83D\uDCBE Save Changes'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast('Stock updated \u2705', 'success');
      closeAionionEditModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });
});

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
