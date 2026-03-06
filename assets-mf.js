// ══════════════════════════════════════════════════════════════
//  MUTUAL FUNDS — import, live NAV refresh, edit, actual invested
// ══════════════════════════════════════════════════════════════

// ── Actual Invested ───────────────────────────────────────────

let _editingMfaiId = null;

async function loadMfActualInvested(userId) {
  const section = document.getElementById('mf-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('mf-monthly-body');
  if (body) body.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>';

  const { data, error } = await sb
    .from('mf_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderMfActualInvested(data || []);
}

function renderMfActualInvested(rows) {
  const body    = document.getElementById('mf-monthly-body');
  const totalEl = document.getElementById('mf-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = 'Total: ' + INR(grand);

  const statTile = document.getElementById('assets-actual-invested');
  if (statTile) statTile.textContent = INR(grand);

  const curValEl = document.getElementById('assets-total-value');
  const currentValue = curValEl ? parseFloat(curValEl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  const actualGain = currentValue - grand;
  const gainPct    = grand > 0 ? ` (${((actualGain / grand) * 100).toFixed(1)}%)` : '';
  const gainColor  = actualGain > 0 ? 'var(--green)' : actualGain < 0 ? 'var(--danger)' : 'var(--muted)';
  const gainLabel  = (actualGain >= 0 ? '+' : '') + INR(actualGain) + gainPct;
  const gainTile   = document.getElementById('assets-actual-gain');
  if (gainTile) { gainTile.textContent = gainLabel; gainTile.style.color = gainColor; }

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="3" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
        <td class="mfai-cb-wrap" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="mfai-cb" data-id="${r.id}" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-mfai-id="${r.id}" data-mfai-date="${r.entry_date}" data-mfai-amount="${r.amount}"
          class="mfai-edit-btn" title="Edit">✏️</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td></td>
  </tr>`;

  if (window['_mf_bindCheckboxes']) window['_mf_bindCheckboxes']();
  body.querySelectorAll('.mfai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openMfaiModal({
      id: btn.dataset.mfaiId, entry_date: btn.dataset.mfaiDate, amount: btn.dataset.mfaiAmount
    }));
  });
}

function openMfaiModal(row = null) {
  _editingMfaiId = row ? row.id : null;
  const titleEl = document.getElementById('mf-invested-modal-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  document.getElementById('mfai-date').value   = row ? (row.entry_date || '') : '';
  document.getElementById('mfai-amount').value = row ? (row.amount    || '') : '';
  document.getElementById('mf-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfaiModal() {
  document.getElementById('mf-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingMfaiId = null;
}

// ── Live NAV Refresh ──────────────────────────────────────────

async function fetchAndRefreshMfPrices(assets) {
  const lastUpdateEl = document.getElementById('mf-last-updated');
  const refreshBtn   = document.getElementById('mf-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live NAVs…';
  if (refreshBtn)   refreshBtn.disabled = true;

  // Yahoo Finance requires .BO suffix for Indian MF symbols (e.g. 0P0000XW75 → 0P0000XW75.BO)
  const symbols = assets.filter(a => a.nav_symbol).map(a => {
    const s = a.nav_symbol;
    return /\.(NS|BO)$/i.test(s) ? s : s + '.BO';
  });

  if (!symbols.length) {
    if (refreshBtn)   refreshBtn.disabled = false;
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ No symbols mapped';
    showToast('No Yahoo Finance symbols found. Re-import CSV to map symbols.', 'error');
    return;
  }

  const prices = await fetchLivePricesRaw(symbols);
  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch NAVs';
    showToast('Live NAV fetch failed', 'error');
    return;
  }

  let totalValue = 0, totalInvested = 0;
  assets.forEach(a => {
    const liveNav     = a.nav_symbol ? getLTP(prices, a.nav_symbol.replace(/\.(NS|BO)$/i, '')) : null;
    const qty         = +a.qty || 0;
    totalInvested    += qty * (+a.avg_cost || 0);
    totalValue       += qty * (liveNav || +a.avg_cost || 0);
  });

  assets.forEach(a => {
    const liveNav = a.nav_symbol ? getLTP(prices, a.nav_symbol.replace(/\.(NS|BO)$/i, '')) : null;
    if (!liveNav) return;

    const qty         = +a.qty || 0;
    const curVal      = qty * liveNav;
    const investedAmt = qty * (+a.avg_cost || 0);
    const gain        = curVal - investedAmt;
    const gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct    = totalValue > 0 ? (curVal / totalValue) * 100 : 0;
    const key         = a.fund_name;

    const navCell = document.querySelector(`[data-live-_live_nav="${key}"]`);
    if (navCell) navCell.textContent = INR(liveNav);

    const cvCell = document.querySelector(`[data-live-current_value="${key}"]`);
    if (cvCell) cvCell.textContent = INR(curVal);

    const allocCell = document.querySelector(`[data-live-_alloc_pct="${key}"]`);
    if (allocCell) {
      const barWidth = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
          <span style="display:block;height:100%;width:${barWidth}%;background:var(--accent);border-radius:99px"></span>
        </span>
        <b style="font-size:12px;color:var(--accent)">${allocPct.toFixed(1)}%</b>
      </span>`;
    }

    const gainTd = document.querySelector(`[data-live-gain="${key}"]`);
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

// ── CSV Import ────────────────────────────────────────────────

let _mfPreviewRows = [];

const MF_SYMBOL_MAP = [
  ['aditya birla sun life large cap',   '0P0000XVWL'],
  ['axis small cap',                    '0P00011MAX'],
  ['groww elss tax saver',              '0P0001BN7D'],
  ['hdfc elss tax saver',               '0P0000XW8Z'],
  ['hdfc focused fund',                 '0P0000XW75'],
  ['hdfc nifty 100 index',              '0P0001OF02'],
  ['icici prudential dividend yield',   '0P000134CI'],
  ['icici prudential nifty midcap 150', '0P0001NYM0'],
  ['kotak elss tax saver',              '0P0000XV6Q'],
  ['motilal oswal midcap',              '0P00012ALS'],
  ['motilal oswal mid cap',             '0P00012ALS'],
  ['nippon india elss tax saver',       '0P00015E14'],
  ['nippon india gold savings',         '0P0000XVDS'],
  ['nippon india growth mid cap',       '0P0000XVDP'],
  ['nippon india growth',               '0P0000XVDP'],
  ['nippon india large cap',            '0P0000XVG6'],
  ['nippon india nifty midcap 150',     '0P0001LMCS'],
  ['nippon india nifty smallcap 250',   '0P0001KR2R'],
  ['nippon india power & infra',        '0P0000XVD7'],
  ['nippon india power',                '0P0000XVD7'],
  ['nippon india small cap',            '0P0000XVFY'],
  ['quant elss tax saver',              '0P0000XW51'],
  ['quant flexi cap',                   '0P0001BA3U'],
  ['sbi contra',                        '0P0000XVJR'],
  ['sundaram elss tax saver',           '0P0001BLNN'],
  ['sundaram large cap',                '0P0001KN71'],
  ['tata elss',                         '0P00014GLS'],
  ['tata large & mid cap',              '0P0001BBCV'],
  ['tata large and mid cap',            '0P0001BBCV'],
  ['tata nifty 50',                     '0P0000XVOZ'],
];

// Funds that exist in both Regular and Direct plans with different Yahoo symbols
// Format: 'fund name fragment (lowercase)' → [regularSymbol, directSymbol]
const MF_DUAL_PLAN_MAP = {
  'quant flexi cap':        ['0P0000XW4X', '0P0001BA3U'],
  'tata large & mid cap':   ['0P0001BBCV', '0P0000XVOJ'],
  'tata large and mid cap': ['0P0001BBCV', '0P0000XVOJ'],
};

function guessNavSymbol(fundName) {
  // Strip plan suffix added during deduplication before matching
  const base  = (fundName || '').replace(/\s*\((Regular|Direct|\d+)\)\s*$/i, '');
  const lower = base.toLowerCase();
  for (let i = 0; i < MF_SYMBOL_MAP.length; i++) {
    if (lower.indexOf(MF_SYMBOL_MAP[i][0]) !== -1) return MF_SYMBOL_MAP[i][1];
  }
  return null;
}

function parseMfCSV(text) {
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

  const iName     = find('instrument', 'fund name', 'scheme');
  const iQty      = find('qty', 'units', 'quantity');
  const iAvgCost  = find('avg. cost', 'avg cost', 'avg nav', 'average');
  const iInvested = find('invested');
  const iCurVal   = find('cur. val', 'cur val', 'current');

  const funds = [];
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

    const clean = idx => (cols[idx] || '').replace(/^"|"$/g, '').trim();
    const num   = idx => parseFloat((cols[idx] || '').replace(/[,₹]/g, '')) || 0;

    const fundName = clean(iName);
    if (!fundName) continue;
    if (/^[A-Z0-9\-\.&]+$/.test(fundName)) continue; // skip ETF/stock rows
    if (/gold/i.test(fundName)) continue;

    const qty      = iQty      >= 0 ? num(iQty)      : 0;
    const avgCost  = iAvgCost  >= 0 ? num(iAvgCost)  : 0;
    const invested = iInvested >= 0 ? num(iInvested) : qty * avgCost;
    const curVal   = iCurVal   >= 0 ? num(iCurVal)   : invested;

    funds.push({ fund_name: fundName, qty, avg_cost: avgCost, invested, current_value: curVal, nav_symbol: guessNavSymbol(fundName) });
  }

  // Deduplicate fund names — same name can appear twice (Regular + Direct plan)
  // Append " (Regular)" / " (Direct)" based on avg_cost: lower = Regular, higher = Direct
  // If still ambiguous, fall back to " (2)", " (3)" etc.
  const nameCounts = {};
  funds.forEach(f => { nameCounts[f.fund_name] = (nameCounts[f.fund_name] || 0) + 1; });

  const nameGroups = {};
  funds.forEach(f => {
    if (nameCounts[f.fund_name] > 1) {
      if (!nameGroups[f.fund_name]) nameGroups[f.fund_name] = [];
      nameGroups[f.fund_name].push(f);
    }
  });

  Object.values(nameGroups).forEach(group => {
    // Sort by avg_cost ascending — lower NAV = Regular plan, higher = Direct plan
    group.sort((a, b) => a.avg_cost - b.avg_cost);
    const labels = group.length === 2 ? ['Regular', 'Direct'] : group.map((_, i) => String(i + 1));
    group.forEach((f, i) => {
      const baseName = f.fund_name;
      f.fund_name = `${baseName} (${labels[i]})`;
      // Check if this fund has known per-plan symbols
      const baseKey = baseName.toLowerCase();
      const dualSyms = Object.keys(MF_DUAL_PLAN_MAP).find(k => baseKey.includes(k));
      if (dualSyms && group.length === 2) {
        f.nav_symbol = MF_DUAL_PLAN_MAP[dualSyms][i]; // [0]=Regular, [1]=Direct
      } else {
        f.nav_symbol = guessNavSymbol(f.fund_name);
      }
    });
  });

  return funds;
}

function openMfImportModal() {
  _mfPreviewRows = [];
  const csvInput = document.getElementById('mf-csv-input');
  if (csvInput) csvInput.value = '';
  const filenameEl = document.getElementById('mf-csv-filename');
  if (filenameEl) filenameEl.textContent = '';
  document.getElementById('mf-preview-section')?.classList.add('hidden');
  document.getElementById('mf-import-confirm-btn')?.classList.add('hidden');
  document.getElementById('mf-import-modal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfImportModal() {
  document.getElementById('mf-import-modal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function handleMfCSV(file) {
  if (!file) return;
  const filenameEl = document.getElementById('mf-csv-filename');
  if (filenameEl) filenameEl.textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    _mfPreviewRows = parseMfCSV(e.target.result);
    const count = _mfPreviewRows.length;

    const countEl       = document.getElementById('mf-fund-count');
    const importCountEl = document.getElementById('mf-import-count');
    if (countEl)       countEl.textContent       = count;
    if (importCountEl) importCountEl.textContent = count;

    const thead = document.getElementById('mf-preview-thead');
    const tbody = document.getElementById('mf-preview-body');
    if (!thead || !tbody) return;

    const thS = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';
    thead.innerHTML = `<tr>
      <th style="${thS};text-align:center;width:32px">✓</th>
      <th style="${thS};text-align:left">Fund Name</th>
      <th style="${thS}">Units</th>
      <th style="${thS}">Avg NAV</th>
      <th style="${thS}">Invested</th>
      <th style="${thS}">Symbol</th>
    </tr>`;

    const tdS = 'padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);font-size:12px';
    tbody.innerHTML = _mfPreviewRows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}" data-idx="${i}">
        <td style="${tdS};text-align:center"><input type="checkbox" class="mf-row-chk" data-idx="${i}" checked style="cursor:pointer;width:15px;height:15px"></td>
        <td style="${tdS};text-align:left;font-weight:600;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.fund_name}</td>
        <td style="${tdS}">${r.qty}</td>
        <td style="${tdS}">${INR(r.avg_cost)}</td>
        <td style="${tdS}">${INR(r.invested)}</td>
        <td style="${tdS};font-size:11px;color:var(--muted2)">${r.nav_symbol || '<span style="color:var(--danger)">?</span>'}</td>
      </tr>`).join('');

    const updateCount = () => {
      const checked = tbody.querySelectorAll('.mf-row-chk:checked').length;
      if (countEl)       countEl.textContent       = checked;
      if (importCountEl) importCountEl.textContent = checked;
      document.getElementById('mf-import-confirm-btn')?.classList.toggle('hidden', checked === 0);
    };
    tbody.querySelectorAll('.mf-row-chk').forEach(chk => chk.addEventListener('change', updateCount));

    document.getElementById('mf-preview-section')?.classList.remove('hidden');
    document.getElementById('mf-import-confirm-btn')?.classList.toggle('hidden', count === 0);
  };
  reader.readAsText(file);
}

async function importMfHoldings(allRows) {
  const checkedIdxs = new Set(
    [...document.querySelectorAll('.mf-row-chk:checked')].map(c => +c.dataset.idx)
  );
  const rows = allRows.filter((_, i) => checkedIdxs.has(i));
  if (!rows.length) { showToast('No funds selected', 'error'); return; }

  const confirmBtn = document.getElementById('mf-import-confirm-btn');
  if (confirmBtn) { confirmBtn.textContent = 'Importing…'; confirmBtn.disabled = true; }

  const { data: existing } = await sb.from('mf_holdings').select('fund_name, qty').eq('user_id', _currentUserId);
  const prevQtyMap = {};
  (existing || []).forEach(r => { prevQtyMap[r.fund_name] = +r.qty || 0; });

  const incomingSet = new Set(rows.map(r => r.fund_name));
  const toDelete    = (existing || []).filter(r => !incomingSet.has(r.fund_name)).map(r => r.fund_name);
  if (toDelete.length) {
    await sb.from('mf_holdings').delete().eq('user_id', _currentUserId).in('fund_name', toDelete);
  }

  const { error } = await sb.from('mf_holdings').upsert(
    rows.map(r => ({
      user_id:     _currentUserId,
      fund_name:   r.fund_name,
      qty:         r.qty,
      prev_qty:    prevQtyMap[r.fund_name] ?? 0,
      avg_cost:    r.avg_cost,
      nav_symbol:  r.nav_symbol || null,
      imported_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,fund_name' }
  );

  if (confirmBtn) { confirmBtn.textContent = `📥 Import ${rows.length} Funds`; confirmBtn.disabled = false; }

  if (error) {
    showToast('Import failed: ' + error.message, 'error');
  } else {
    showToast(`✅ Imported ${rows.length} funds!`, 'success');
    closeMfImportModal();
    loadAssets(_currentUserId, 'Mutual Funds');
  }
}

// ── Edit Modal ────────────────────────────────────────────────

let _editingMfId = null;

function openMfEditModal(row) {
  _editingMfId = row ? (row.id || null) : null;
  const titleEl = document.getElementById('mf-edit-modal-title');
  if (titleEl) titleEl.textContent = 'Edit — ' + (row ? (row.fund_name || 'Fund') : 'Fund');
  document.getElementById('mfe-name').value     = row ? (row.fund_name || '') : '';
  document.getElementById('mfe-qty').value      = row ? (row.qty       || '') : '';
  document.getElementById('mfe-avg-cost').value = row ? (row.avg_cost  || '') : '';
  document.getElementById('mf-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfEditModal() {
  document.getElementById('mf-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingMfId = null;
}

// ══════════════════════════════════════════════════════════════
//  EVENT WIRING  (all inside fragments-loaded)
// ══════════════════════════════════════════════════════════════

document.addEventListener('fragments-loaded', () => {

  // ── Actual Invested modal ──────────────────────────────────
  const modal = document.getElementById('mf-invested-modal');
  document.getElementById('mf-invested-add-btn')?.addEventListener('click',    () => openMfaiModal());
  document.getElementById('mf-invested-close-btn')?.addEventListener('click',  closeMfaiModal);
  document.getElementById('mf-invested-cancel-btn')?.addEventListener('click', closeMfaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeMfaiModal(); });

  document.getElementById('mf-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('mfai-date').value;
    const amount = parseFloat(document.getElementById('mfai-amount').value);
    if (!date)                  { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('mf-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
    const payload = { entry_date: date, amount };
    let op;
    if (_editingMfaiId) {
      op = sb.from('mf_actual_invested').update(payload).eq('id', _editingMfaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('mf_actual_invested').insert(payload);
    }
    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast(_editingMfaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success'); closeMfaiModal(); loadMfActualInvested(_currentUserId); }
  });

  // ── Refresh button ─────────────────────────────────────────
  document.getElementById('mf-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Mutual Funds') loadAssets(_currentUserId, 'Mutual Funds');
  });

  // ── Import modal ───────────────────────────────────────────
  const modal2 = document.getElementById('mf-import-modal');
  document.getElementById('mf-import-btn')?.addEventListener('click',        openMfImportModal);
  document.getElementById('mf-import-close-btn')?.addEventListener('click',  closeMfImportModal);
  document.getElementById('mf-import-cancel-btn')?.addEventListener('click', closeMfImportModal);
  modal2?.addEventListener('click', e => { if (e.target === modal2) closeMfImportModal(); });

  document.getElementById('mf-csv-input')?.addEventListener('change', e => {
    handleMfCSV(e.target.files[0]);
  });
  document.getElementById('mf-import-confirm-btn')?.addEventListener('click', () => {
    if (_mfPreviewRows.length) importMfHoldings(_mfPreviewRows);
  });

  // ── Edit modal ─────────────────────────────────────────────
  const modal3 = document.getElementById('mf-edit-modal');
  document.getElementById('mf-edit-close-btn')?.addEventListener('click',  closeMfEditModal);
  document.getElementById('mf-edit-cancel-btn')?.addEventListener('click', closeMfEditModal);
  modal3?.addEventListener('click', e => { if (e.target === modal3) closeMfEditModal(); });

  document.getElementById('mf-edit-save-btn')?.addEventListener('click', async () => {
    if (!_editingMfId) return;
    const qty     = parseFloat(document.getElementById('mfe-qty').value);
    const avgCost = parseFloat(document.getElementById('mfe-avg-cost').value);
    if (!qty || qty <= 0)         { showToast('Units must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg NAV must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('mf-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
    const { error } = await sb.from('mf_holdings').update({ qty, avg_cost: avgCost }).eq('id', _editingMfId);
    saveBtn.textContent = '💾 Save Changes'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast('Fund updated ✅', 'success'); closeMfEditModal(); loadAssets(_currentUserId, _currentAssetFilter); }
  });

  // ── Bulk-select for Actual Invested ───────────────────────
  (function() {
    var _sel = false;
    var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function _enter() {
      _sel = true;
      var btn = document.getElementById('mf-select-btn');
      if (btn) { btn.innerHTML = '✕ Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
      document.getElementById('mf-bulk-bar')?.classList.remove('hidden');
      document.querySelectorAll('.mfai-cb-wrap').forEach(c => { c.style.display = ''; });
      _upd();
    }

    function _exit() {
      _sel = false;
      var btn = document.getElementById('mf-select-btn');
      if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
      document.getElementById('mf-bulk-bar')?.classList.add('hidden');
      document.getElementById('mf-bulk-normal').style.display = 'flex';
      document.getElementById('mf-bulk-confirm').style.display = 'none';
      document.querySelectorAll('.mfai-cb-wrap').forEach(c => { c.style.display = 'none'; });
      document.querySelectorAll('.mfai-cb').forEach(c => { c.checked = false; });
      _upd();
    }

    function _upd() {
      var n       = document.querySelectorAll('.mfai-cb:checked').length;
      var countEl = document.getElementById('mf-bulk-count');
      var delBtn  = document.getElementById('mf-bulk-delete');
      if (countEl) countEl.textContent = n + ' selected';
      if (delBtn)  delBtn.disabled = n === 0;
    }

    document.getElementById('mf-select-btn')?.addEventListener('click', () => { if (_sel) _exit(); else _enter(); });
    document.getElementById('mf-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('mf-bulk-delete')?.addEventListener('click', () => {
      var n = document.querySelectorAll('.mfai-cb:checked').length;
      if (!n) return;
      document.getElementById('mf-bulk-normal').style.display = 'none';
      document.getElementById('mf-bulk-confirm').style.display = 'flex';
      document.getElementById('mf-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('mf-bulk-no')?.addEventListener('click', () => {
      document.getElementById('mf-bulk-normal').style.display = 'flex';
      document.getElementById('mf-bulk-confirm').style.display = 'none';
    });

    document.getElementById('mf-bulk-yes')?.addEventListener('click', async () => {
      var checked = [...document.querySelectorAll('.mfai-cb:checked')];
      if (!checked.length) return;
      var yesBtn = document.getElementById('mf-bulk-yes');
      yesBtn.textContent = 'Deleting…'; yesBtn.disabled = true;
      var anyErr = false;
      for (var cb of checked) {
        var r = await sb.from('mf_actual_invested').delete().eq('id', cb.dataset.id);
        if (r.error) { showToast('Delete failed: ' + r.error.message, 'error'); anyErr = true; }
      }
      yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
      if (!anyErr) showToast(checked.length + ' ' + (checked.length === 1 ? 'entry' : 'entries') + ' deleted', 'success');
      _exit();
      loadMfActualInvested(_currentUserId);
    });

    window['_mf_bindCheckboxes'] = function() {
      document.querySelectorAll('.mfai-cb').forEach(cb => { cb.addEventListener('change', _upd); });
      document.querySelectorAll('.mfai-cb-wrap').forEach(c => { c.style.display = _sel ? '' : 'none'; });
      if (_sel) _upd();
    };
  })();

});