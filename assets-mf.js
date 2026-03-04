// ══════════════════════════════════════════════════════════════
//  MUTUAL FUNDS — CSV import, edit, refresh, actual invested
// ══════════════════════════════════════════════════════════════

// ── MF Actual Invested ────────────────────────────────────────

let _editingMfaiId = null;

async function loadMfActualInvested(userId) {
  const section = document.getElementById('mf-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('mf-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('mf_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderMfActualInvested(data || []);
}

function renderMfActualInvested(rows) {
  const body    = document.getElementById('mf-monthly-body');
  const totalEl = document.getElementById('mf-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${INR(grand)}`;

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
          data-mfai-id="${r.id}" data-mfai-date="${r.entry_date}" data-mfai-amount="${r.amount}" data-mfai-notes="${r.notes || ''}"
          class="mfai-edit-btn" title="Edit">✏️</button>
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-mfai-id="${r.id}" class="mfai-delete-btn" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  body.querySelectorAll('.mfai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openMfaiModal({
      id: btn.dataset.mfaiId, entry_date: btn.dataset.mfaiDate,
      amount: btn.dataset.mfaiAmount, notes: btn.dataset.mfaiNotes
    }));
  });
  body.querySelectorAll('.mfai-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      const { error } = await sb.from('mf_actual_invested').delete().eq('id', btn.dataset.mfaiId);
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
      showToast('Entry deleted', 'success');
      loadMfActualInvested(_currentUserId);
    });
  });
}

function openMfaiModal(row = null) {
  _editingMfaiId = row?.id || null;
  const titleEl = document.getElementById('mf-invested-modal-title');
  const saveBtn = document.getElementById('mf-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '💾 Save Entry';
  document.getElementById('mfai-date').value   = row?.entry_date || '';
  document.getElementById('mfai-amount').value = row?.amount    || '';
  document.getElementById('mfai-notes').value  = row?.notes     || '';
  document.getElementById('mf-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfaiModal() {
  document.getElementById('mf-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingMfaiId = null;
}

document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('mf-invested-modal');
  document.getElementById('mf-invested-add-btn')?.addEventListener('click',    () => openMfaiModal());
  document.getElementById('mf-invested-close-btn')?.addEventListener('click',  closeMfaiModal);
  document.getElementById('mf-invested-cancel-btn')?.addEventListener('click', closeMfaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeMfaiModal(); });

  document.getElementById('mf-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('mfai-date').value;
    const amount = parseFloat(document.getElementById('mfai-amount').value);
    const notes  = document.getElementById('mfai-notes').value.trim() || null;

    if (!date)               { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('mf-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount, notes };
    let op;
    if (_editingMfaiId) {
      op = sb.from('mf_actual_invested').update(payload).eq('id', _editingMfaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('mf_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingMfaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeMfaiModal();
      loadMfActualInvested(_currentUserId);
    }
  });
});

// ── MF Live NAV Refresh ───────────────────────────────────────

/**
 * Fetch live NAVs for mutual funds.
 * MF names from Zerodha CSV are full names like "HDFC Focused Fund".
 * We look them up via Yahoo Finance using the ISIN/symbol approach:
 * Zerodha uses symbols like "0P0001EMRT.BO" but we don't have those.
 * Instead we store the fund name as the key and use mf_nav_symbols table
 * to map name → Yahoo symbol on first import.
 *
 * Fallback: if no Yahoo symbol mapped, current_value stays as avg_cost * qty.
 */
async function fetchAndRefreshMfPrices(assets) {
  const lastUpdateEl = document.getElementById('mf-last-updated');
  const refreshBtn   = document.getElementById('mf-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live NAVs…';
  if (refreshBtn)   refreshBtn.disabled = true;

  // Build symbol list — use nav_symbol if stored, otherwise skip
  const symbolMap = {};  // yahoo_symbol → fund_name
  assets.forEach(a => {
    if (a.nav_symbol) symbolMap[a.nav_symbol] = a.fund_name;
  });

  const symbols = Object.keys(symbolMap);

  if (!symbols.length) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ No NAV symbols mapped yet';
    if (refreshBtn) refreshBtn.disabled = false;
    return;
  }

  // Call /api/prices with .BO suffix for MF symbols
  const queryStr = symbols.join(',');
  let prices = null;
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(queryStr)}`);
    if (res.ok) {
      const raw = await res.json();
      if (!raw.error) prices = raw;
    }
  } catch (e) {
    console.warn('[MF NAV] fetch failed:', e.message);
  }

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch NAVs';
    return;
  }

  let totalValue = 0, totalInvested = 0;

  assets.forEach(a => {
    const sym = a.nav_symbol;
    const nav = sym ? getLTP(prices, sym.replace(/\.(NS|BO)$/, '')) : null;
    totalValue    += (+a.qty || 0) * (nav || +a.avg_cost || 0);
    totalInvested += (+a.qty || 0) * (+a.avg_cost || 0);
  });

  assets.forEach(a => {
    const sym = a.nav_symbol;
    const nav = sym ? getLTP(prices, sym.replace(/\.(NS|BO)$/, '')) : null;
    if (!nav) return;

    const qty         = +a.qty || 0;
    const curVal      = qty * nav;
    const investedAmt = qty * (+a.avg_cost || 0);
    const gain        = curVal - investedAmt;
    const gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct    = totalValue > 0 ? ((curVal / totalValue) * 100) : 0;

    const cvCell = document.querySelector(`[data-live-current_value="${a.fund_name}"]`);
    if (cvCell) cvCell.textContent = INR(curVal);

    const allocCell = document.querySelector(`[data-live-_alloc_pct="${a.fund_name}"]`);
    if (allocCell) {
      const barWidth = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
          <span style="display:block;height:100%;width:${barWidth}%;background:var(--accent);border-radius:99px"></span>
        </span>
        <b style="font-size:12px;color:var(--accent)">${allocPct.toFixed(1)}%</b>
      </span>`;
    }

    const gainTd = document.querySelector(`[data-live-gain="${a.fund_name}"]`);
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

// Wire Refresh button
document.addEventListener('fragments-loaded', () => {
  document.getElementById('mf-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Mutual Funds') {
      loadAssets(_currentUserId, 'Mutual Funds');
    }
  });
});

// ── MF CSV Parse ──────────────────────────────────────────────

let _mfPreviewRows = [];

/**
 * Parse Zerodha Holdings CSV — extract only Mutual Fund rows.
 * MF rows have mixed-case full names (not ALL CAPS stock symbols).
 * Also excludes Gold funds.
 */
function parseMfCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const find = (...names) => {
    for (const name of names) {
      const idx = header.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iName     = find('Instrument');
  const iQty      = find('Qty');
  const iAvgCost  = find('Avg. cost', 'Avg cost', 'avg_cost');
  const iInvested = find('Invested');
  const iCurVal   = find('Cur. val', 'Cur val', 'current_value');
  const iPnL      = find('P&L', 'P&amp;L');
  const iNetChg   = find('Net chg');
  const iDayChg   = find('Day chg');

  const funds = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || lines[i].split(',');
    const clean = c => (c || '').toString().replace(/^"|"$/g, '').trim();
    const num   = c => parseFloat(clean(c)) || 0;

    const name = clean(cols[iName]);
    if (!name) continue;

    // MF detection: name has lowercase letters (stocks are ALL CAPS)
    const isMF = /[a-z]/.test(name);
    if (!isMF) continue;

    // Exclude gold funds
    if (/gold/i.test(name)) continue;

    funds.push({
      fund_name:     name,
      qty:           num(cols[iQty]),
      avg_cost:      num(cols[iAvgCost]),
      invested:      num(cols[iInvested]),
      current_value: num(cols[iCurVal]),
      pnl:           num(cols[iPnL]),
      net_chg:       num(cols[iNetChg]),
      day_chg:       num(cols[iDayChg]),
    });
  }
  return funds;
}

// ── MF Import Modal ───────────────────────────────────────────

function openMfImportModal() {
  _mfPreviewRows = [];
  document.getElementById('mf-csv-input').value = '';
  document.getElementById('mf-csv-filename').textContent = '';
  document.getElementById('mf-preview-section').classList.add('hidden');
  document.getElementById('mf-import-confirm-btn').classList.add('hidden');
  document.getElementById('mf-import-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfImportModal() {
  document.getElementById('mf-import-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function handleMfCSV(file) {
  if (!file) return;
  document.getElementById('mf-csv-filename').textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    _mfPreviewRows = parseMfCSV(e.target.result);
    const count    = _mfPreviewRows.length;

    document.getElementById('mf-fund-count').textContent  = count;
    document.getElementById('mf-import-count').textContent = count;

    const thead = document.getElementById('mf-preview-thead');
    const tbody = document.getElementById('mf-preview-body');
    const thStyle = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';
    thead.innerHTML = `<tr>
      <th style="${thStyle};text-align:center;width:32px" title="Include in import">✓</th>
      <th style="${thStyle};text-align:left">Fund Name</th>
      <th style="${thStyle}">Units</th>
      <th style="${thStyle}">Avg NAV</th>
      <th style="${thStyle}">Invested</th>
      <th style="${thStyle}">Cur. Value</th>
      <th style="${thStyle}">P&amp;L</th>
    </tr>`;

    const tdS = 'padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);font-size:12px';
    tbody.innerHTML = _mfPreviewRows.map((r, i) => {
      const pnlColor = r.pnl >= 0 ? 'var(--green)' : 'var(--danger)';
      return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}" data-idx="${i}">
        <td style="${tdS};text-align:center">
          <input type="checkbox" class="mf-row-chk" data-idx="${i}" checked style="cursor:pointer;width:15px;height:15px">
        </td>
        <td style="${tdS};text-align:left;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.fund_name}</td>
        <td style="${tdS}">${r.qty}</td>
        <td style="${tdS}">${INR(r.avg_cost)}</td>
        <td style="${tdS}">${INR(r.invested)}</td>
        <td style="${tdS};font-weight:600">${INR(r.current_value)}</td>
        <td style="${tdS};color:${pnlColor};font-weight:600">${INR(r.pnl)}</td>
      </tr>`;
    }).join('');

    const updateCount = () => {
      const checked = tbody.querySelectorAll('.mf-row-chk:checked').length;
      document.getElementById('mf-import-count').textContent = checked;
      document.getElementById('mf-fund-count').textContent   = checked;
      const btn = document.getElementById('mf-import-confirm-btn');
      if (checked > 0) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    };
    tbody.querySelectorAll('.mf-row-chk').forEach(chk => chk.addEventListener('change', updateCount));

    document.getElementById('mf-preview-section').classList.remove('hidden');
    if (count > 0) document.getElementById('mf-import-confirm-btn').classList.remove('hidden');
    else document.getElementById('mf-import-confirm-btn').classList.add('hidden');
  };
  reader.readAsText(file);
}

async function importMfFunds(allRows) {
  const checkedIdxs = new Set(
    [...document.querySelectorAll('.mf-row-chk:checked')].map(c => +c.dataset.idx)
  );
  const rows = allRows.filter((_, i) => checkedIdxs.has(i));
  if (!rows.length) { showToast('No funds selected', 'error'); return; }

  const confirmBtn = document.getElementById('mf-import-confirm-btn');
  confirmBtn.textContent = 'Importing…';
  confirmBtn.disabled = true;

  // Fetch existing to get prev_qty
  const { data: existing } = await sb
    .from('mf_holdings')
    .select('fund_name, qty')
    .eq('user_id', _currentUserId);

  const prevQtyMap = {};
  (existing || []).forEach(r => { prevQtyMap[r.fund_name] = +r.qty || 0; });

  const incomingSet = new Set(deduped.map(r => r.fund_name));

  // Delete funds no longer in CSV
  const toDelete = (existing || []).filter(r => !incomingSet.has(r.fund_name)).map(r => r.fund_name);
  if (toDelete.length) {
    await sb.from('mf_holdings').delete().eq('user_id', _currentUserId).in('fund_name', toDelete);
  }

  // Deduplicate by fund_name — merge rows with same name (e.g. Quant Flexi Cap Fund appears twice)
  const mergedMap = {};
  rows.forEach(r => {
    if (mergedMap[r.fund_name]) {
      // Merge: sum qty and invested, recalculate avg_cost
      const existing = mergedMap[r.fund_name];
      const totalInvested = existing.qty * existing.avg_cost + r.qty * r.avg_cost;
      const totalQty      = existing.qty + r.qty;
      existing.qty      = totalQty;
      existing.avg_cost = totalQty > 0 ? totalInvested / totalQty : existing.avg_cost;
    } else {
      mergedMap[r.fund_name] = { ...r };
    }
  });
  const deduped = Object.values(mergedMap);

  const payload = deduped.map(r => ({
    user_id:   _currentUserId,
    fund_name: r.fund_name,
    qty:       r.qty,
    prev_qty:  prevQtyMap[r.fund_name] ?? 0,
    avg_cost:  r.avg_cost,
    imported_at: new Date().toISOString(),
  }));

  const { error } = await sb
    .from('mf_holdings')
    .upsert(payload, { onConflict: 'user_id,fund_name' });

  confirmBtn.textContent = `📥 Import ${deduped.length} Funds`;
  confirmBtn.disabled = false;

  if (error) {
    showToast('Import failed: ' + error.message, 'error');
  } else {
    showToast(`✅ Imported ${deduped.length} funds successfully!`, 'success');
    closeMfImportModal();
    loadAssets(_currentUserId, 'Mutual Funds');
  }
}

// Wire MF import modal
document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('mf-import-modal');
  document.getElementById('mf-import-btn')?.addEventListener('click', openMfImportModal);
  document.getElementById('mf-import-close-btn')?.addEventListener('click', closeMfImportModal);
  document.getElementById('mf-import-cancel-btn')?.addEventListener('click', closeMfImportModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeMfImportModal(); });

  document.getElementById('mf-csv-input')?.addEventListener('change', e => {
    handleMfCSV(e.target.files[0]);
  });

  document.getElementById('mf-import-confirm-btn')?.addEventListener('click', () => {
    if (_mfPreviewRows.length) importMfFunds(_mfPreviewRows);
  });
});

// ── MF Edit Modal ─────────────────────────────────────────────

let _editingMfId = null;
let _editingMfCurrentQty = null;

function openMfEditModal(row) {
  const isAdd = !row;
  _editingMfId         = row?.id   || null;
  _editingMfCurrentQty = +row?.qty || 0;

  document.getElementById('mf-edit-modal-title').textContent = isAdd ? 'Add Fund' : `Edit — ${row.fund_name}`;
  const nameEl = document.getElementById('mfe-name');
  nameEl.value    = row?.fund_name ?? '';
  nameEl.readOnly = !isAdd;
  nameEl.style.background = isAdd ? '' : 'var(--surface2)';
  nameEl.style.color      = isAdd ? '' : 'var(--muted)';
  nameEl.style.cursor     = isAdd ? '' : 'not-allowed';

  document.getElementById('mfe-qty').value      = row?.qty      ?? '';
  document.getElementById('mfe-avg-cost').value = row?.avg_cost ?? '';

  const saveBtn = document.getElementById('mf-edit-save-btn');
  if (saveBtn) saveBtn.textContent = isAdd ? '💾 Add Fund' : '💾 Save Changes';

  document.getElementById('mf-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfEditModal() {
  document.getElementById('mf-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingMfId = null;
}

document.addEventListener('fragments-loaded', () => {
  document.getElementById('mf-edit-close-btn')?.addEventListener('click', closeMfEditModal);
  document.getElementById('mf-edit-cancel-btn')?.addEventListener('click', closeMfEditModal);
  document.getElementById('mf-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('mf-edit-modal')) closeMfEditModal();
  });

  document.getElementById('mf-edit-save-btn')?.addEventListener('click', async () => {
    const isAddMode  = !_editingMfId;
    const fund_name  = document.getElementById('mfe-name').value.trim();
    if (isAddMode && !fund_name) { showToast('Fund name is required', 'error'); return; }

    const qty     = parseFloat(document.getElementById('mfe-qty').value);
    const avgCost = parseFloat(document.getElementById('mfe-avg-cost').value);

    if (!qty || qty <= 0)         { showToast('Units must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg NAV must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('mf-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    let error;
    if (isAddMode) {
      ({ error } = await sb.from('mf_holdings').insert({
        user_id: _currentUserId, fund_name, qty, prev_qty: 0, avg_cost: avgCost,
      }));
    } else {
      const payload = { qty, avg_cost: avgCost };
      if (qty !== _editingMfCurrentQty) payload.prev_qty = _editingMfCurrentQty;
      ({ error } = await sb.from('mf_holdings').update(payload).eq('id', _editingMfId));
    }

    saveBtn.textContent = isAddMode ? '💾 Add Fund' : '💾 Save Changes';
    saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(isAddMode ? 'Fund added 🎉' : 'Fund updated ✅', 'success');
      closeMfEditModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });
});