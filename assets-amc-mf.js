// ══════════════════════════════════════════════════════════════
//  AMC MUTUAL FUNDS — manual entry, live NAV, actual invested
// ══════════════════════════════════════════════════════════════

// ── Actual Invested ───────────────────────────────────────────

let _editingAmcMfaiId = null;

async function loadAmcMfActualInvested(userId) {
  const section = document.getElementById('amc-mf-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('amc-mf-monthly-body');
  if (body) body.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--muted2)">Loading\u2026</td></tr>';

  const { data, error } = await sb
    .from('amc_mf_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--danger)">' + error.message + '</td></tr>';
    return;
  }
  renderAmcMfActualInvested(data || []);
}

function renderAmcMfActualInvested(rows) {
  const body    = document.getElementById('amc-mf-monthly-body');
  const totalEl = document.getElementById('amc-mf-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = 'Total: ' + INR(grand);

  const statTile = document.getElementById('assets-actual-invested');
  if (statTile) statTile.textContent = INR(grand);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="3" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet \u2014 click <b>+ Add</b></td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<tr style="background:' + (i % 2 === 0 ? '#fff' : 'var(--surface2)') + '">' +
      '<td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">' + dateStr + '</td>' +
      '<td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">' + INR(r.amount) + '</td>' +
      '<td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">' +
        '<button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" ' +
          'data-id="' + r.id + '" data-date="' + r.entry_date + '" data-amount="' + r.amount + '" ' +
          'class="amcmfai-edit-btn" title="Edit">\u270f\ufe0f</button>' +
        '<button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" ' +
          'data-id="' + r.id + '" class="amcmfai-delete-btn" title="Delete">\ud83d\uddd1</button>' +
      '</td>' +
    '</tr>';
  }).join('') +
    '<tr style="background:var(--surface2)">' +
    '<td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>' +
    '<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">' + INR(grand) + '</td>' +
    '<td></td></tr>';

  body.querySelectorAll('.amcmfai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openAmcMfaiModal({
      id: btn.dataset.id, entry_date: btn.dataset.date, amount: btn.dataset.amount
    }));
  });
  body.querySelectorAll('.amcmfai-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      const { error } = await sb.from('amc_mf_actual_invested').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
      showToast('Entry deleted', 'success');
      loadAmcMfActualInvested(_currentUserId);
    });
  });
}

function openAmcMfaiModal(row = null) {
  _editingAmcMfaiId = row?.id || null;
  const titleEl = document.getElementById('amc-mf-invested-modal-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  document.getElementById('amcmfai-date').value   = row?.entry_date || '';
  document.getElementById('amcmfai-amount').value = row?.amount     || '';
  document.getElementById('amc-mf-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAmcMfaiModal() {
  document.getElementById('amc-mf-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAmcMfaiId = null;
}

// ── Edit / Add Modal ──────────────────────────────────────────

let _editingAmcMfId = null;

function openAmcMfEditModal(row = null) {
  _editingAmcMfId = row?.id || null;
  const titleEl = document.getElementById('amc-mf-edit-modal-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Fund' : 'Add Fund';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  // Fund name: read from DOM live cell if editing, blank if new
  const nameEl = document.getElementById('amcmf-name');
  if (nameEl) {
    if (row?.nav_symbol) {
      const liveCell = document.querySelector('[data-live-_name="' + row.nav_symbol + '"]');
      nameEl.value = liveCell ? liveCell.textContent.trim() : '';
    } else {
      nameEl.value = '';
    }
  }

  set('amcmf-platform',  row?.platform);
  set('amcmf-folio',     row?.folio_number);
  set('amcmf-symbol',    row?.nav_symbol);
  set('amcmf-qty',       row?.qty);
  set('amcmf-avg-cost',  row?.avg_cost);

  document.getElementById('amc-mf-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAmcMfEditModal() {
  document.getElementById('amc-mf-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAmcMfId = null;
}

// ── Live NAV Refresh (auto on load) ──────────────────────────

async function fetchAndRefreshAmcMfPrices(assets) {
  const lastUpdateEl = document.getElementById('amc-mf-last-updated');
  if (lastUpdateEl) lastUpdateEl.textContent = '\ud83d\udd04 Fetching live NAVs\u2026';

  const symbols = assets.filter(a => a.nav_symbol).map(a => a.nav_symbol);
  if (!symbols.length) {
    if (lastUpdateEl) lastUpdateEl.textContent = '\u26a0\ufe0f No tickers found';
    return;
  }

  const prices = await fetchLivePricesRaw(symbols);
  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '\u26a0\ufe0f Could not fetch NAVs';
    return;
  }

  let totalValue = 0, totalInvested = 0;

  // First pass: totals
  assets.forEach(a => {
    const key    = a.nav_symbol ? a.nav_symbol.replace(/\.(NS|BO)$/, '') : null;
    const liveNav = key ? getLTP(prices, key) : null;
    const qty    = +a.qty || 0;
    totalInvested += qty * (+a.avg_cost || 0);
    totalValue    += qty * (liveNav || +a.avg_cost || 0);
  });

  // Second pass: patch DOM cells
  assets.forEach(a => {
    const key     = a.nav_symbol ? a.nav_symbol.replace(/\.(NS|BO)$/, '') : null;
    const liveNav = key ? getLTP(prices, key) : null;
    const liveName = key && prices[key] ? prices[key].name || null : null;
    const qty     = +a.qty || 0;
    const curVal  = qty * (liveNav || +a.avg_cost || 0);
    const invested = qty * (+a.avg_cost || 0);
    const gain    = curVal - invested;
    const gainPct = invested > 0 ? ((gain / invested) * 100).toFixed(1) : null;
    const allocPct = totalValue > 0 ? (curVal / totalValue) * 100 : 0;
    const keyDom  = a.nav_symbol; // DOM cells keyed by nav_symbol

    if (liveName) {
      const nameCell = document.querySelector('[data-live-_name="' + keyDom + '"]');
      if (nameCell) nameCell.textContent = liveName;
    }

    const navCell = document.querySelector('[data-live-_live_nav="' + keyDom + '"]');
    if (navCell) navCell.textContent = liveNav ? INR(liveNav) : '\u2014';

    const cvCell = document.querySelector('[data-live-current_value="' + keyDom + '"]');
    if (cvCell) cvCell.textContent = INR(curVal);

    const allocCell = document.querySelector('[data-live-_alloc_pct="' + keyDom + '"]');
    if (allocCell) {
      const w = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML =
        '<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">' +
        '<span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">' +
        '<span style="display:block;height:100%;width:' + w + '%;background:var(--accent);border-radius:99px"></span></span>' +
        '<b style="font-size:12px;color:var(--accent)">' + allocPct.toFixed(1) + '%</b></span>';
    }

    const gainTd = document.querySelector('[data-live-gain="' + keyDom + '"]');
    if (gainTd) {
      const arrow    = gain >= 0 ? '\u25b2' : '\u25bc';
      const badgeCls = gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'zero';
      gainTd.innerHTML = '<span class="gain-badge ' + badgeCls + '">' + arrow + ' ' + INR(Math.abs(gain)) + (gainPct ? ' (' + gainPct + '%)' : '') + '</span>';
    }
  });

  // Update stat tiles
  const totalGain    = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? ' (' + ((totalGain / totalInvested) * 100).toFixed(1) + '%)' : '';
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('assets-total-value',    INR(totalValue));
  setEl('assets-total-invested', INR(totalInvested));
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + totalGainPct;
    gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpdateEl) lastUpdateEl.textContent = '\ud83d\udfe2 Live \u00b7 ' + now;
}

// ── Event wiring ──────────────────────────────────────────────

document.addEventListener('fragments-loaded', () => {
  // Edit modal
  document.getElementById('amc-mf-edit-close-btn')?.addEventListener('click', closeAmcMfEditModal);
  document.getElementById('amc-mf-edit-cancel-btn')?.addEventListener('click', closeAmcMfEditModal);
  document.getElementById('amc-mf-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('amc-mf-edit-modal')) closeAmcMfEditModal();
  });

  document.getElementById('amc-mf-edit-save-btn')?.addEventListener('click', async () => {
    const platform = document.getElementById('amcmf-platform').value.trim();
    const folio    = document.getElementById('amcmf-folio').value.trim();
    const symbol   = document.getElementById('amcmf-symbol').value.trim();
    const qty      = parseFloat(document.getElementById('amcmf-qty').value);
    const avgCost  = parseFloat(document.getElementById('amcmf-avg-cost').value);

    if (!symbol)            { showToast('Yahoo Ticker is required', 'error'); return; }
    if (isNaN(qty) || qty <= 0)     { showToast('Units must be greater than 0', 'error'); return; }
    if (isNaN(avgCost) || avgCost <= 0) { showToast('Avg NAV must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('amc-mf-edit-save-btn');
    saveBtn.textContent = 'Saving\u2026'; saveBtn.disabled = true;

    const payload = {
      platform:      platform || null,
      folio_number:  folio    || null,
      nav_symbol:    symbol,
      qty,
      avg_cost:      avgCost,
    };

    let op;
    if (_editingAmcMfId) {
      op = sb.from('amc_mf_holdings').update(payload).eq('id', _editingAmcMfId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('amc_mf_holdings').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '\ud83d\udcbe Save'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingAmcMfId ? 'Fund updated \u2705' : 'Fund added \ud83c\udf89', 'success');
      closeAmcMfEditModal();
      loadAssets(_currentUserId, 'AMC Mutual Funds');
    }
  });

  // Actual invested modal
  document.getElementById('amc-mf-invested-close-btn')?.addEventListener('click', closeAmcMfaiModal);
  document.getElementById('amc-mf-invested-cancel-btn')?.addEventListener('click', closeAmcMfaiModal);
  document.getElementById('amc-mf-invested-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('amc-mf-invested-modal')) closeAmcMfaiModal();
  });
  document.getElementById('amc-mf-invested-add-btn')?.addEventListener('click', () => openAmcMfaiModal());

  document.getElementById('amc-mf-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('amcmfai-date').value;
    const amount = parseFloat(document.getElementById('amcmfai-amount').value);

    if (!date)                     { showToast('Date is required', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('amc-mf-invested-save-btn');
    saveBtn.textContent = 'Saving\u2026'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount };
    let op;
    if (_editingAmcMfaiId) {
      op = sb.from('amc_mf_actual_invested').update(payload).eq('id', _editingAmcMfaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('amc_mf_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '\ud83d\udcbe Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingAmcMfaiId ? 'Entry updated \u2705' : 'Entry added \ud83c\udf89', 'success');
      closeAmcMfaiModal();
      loadAmcMfActualInvested(_currentUserId);
    }
  });
});