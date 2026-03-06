// ══════════════════════════════════════════════════════════════
//  AIONION GOLD — manual entry ETF, live price refresh
// ══════════════════════════════════════════════════════════════

// ── Actual Invested ───────────────────────────────────────────

let _editingAgaiId = null;

async function loadAionionGoldActualInvested(userId) {
  const section = document.getElementById('aionion-gold-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('aionion-gold-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('aionion_gold_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderAionionGoldActualInvested(data || []);
}

function renderAionionGoldActualInvested(rows) {
  const body    = document.getElementById('aionion-gold-monthly-body');
  const totalEl = document.getElementById('aionion-gold-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${INR(grand)}`;

  const statTile = document.getElementById('assets-actual-invested');
  if (statTile) statTile.textContent = INR(grand);

  const curValEl     = document.getElementById('assets-total-value');
  const currentValue = curValEl ? parseFloat(curValEl.textContent.replace(/[^\d.-]/g, '')) || 0 : 0;
  const actualGain   = currentValue - grand;
  const gainPct      = grand > 0 ? ` (${((actualGain / grand) * 100).toFixed(1)}%)` : '';
  const gainColor    = actualGain > 0 ? 'var(--green)' : actualGain < 0 ? 'var(--danger)' : 'var(--muted)';
  const gainTile     = document.getElementById('assets-actual-gain');
  if (gainTile) { gainTile.textContent = (actualGain >= 0 ? '+' : '') + INR(actualGain) + gainPct; gainTile.style.color = gainColor; }

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="3" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
        <td class="agai-cb-wrap" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="agai-cb" data-id="${r.id}" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-agai-id="${r.id}" data-agai-date="${r.entry_date}" data-agai-amount="${r.amount}"
          class="agai-edit-btn" title="Edit">✏️</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  if (window['_aionionGold_bindCheckboxes']) window['_aionionGold_bindCheckboxes']();
  body.querySelectorAll('.agai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openAgaiModal({
      id: btn.dataset.agaiId, entry_date: btn.dataset.agaiDate, amount: btn.dataset.agaiAmount
    }));
  });
}

function openAgaiModal(row = null) {
  _editingAgaiId = row?.id || null;
  const titleEl = document.getElementById('aionion-gold-invested-modal-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  document.getElementById('agai-date').value   = row?.entry_date || '';
  document.getElementById('agai-amount').value = row?.amount    || '';
  document.getElementById('aionion-gold-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAgaiModal() {
  document.getElementById('aionion-gold-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAgaiId = null;
}

// ── Live Price Refresh ────────────────────────────────────────

async function fetchAndRefreshAionionGoldPrices(assets) {
  const lastUpdateEl = document.getElementById('aionion-gold-last-updated');
  const refreshBtn   = document.getElementById('aionion-gold-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live prices…';
  if (refreshBtn)   refreshBtn.disabled = true;

  const instruments = assets.map(a => a.instrument);
  const prices      = await fetchLivePrices(instruments);

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    showToast('Live price fetch failed', 'error');
    return;
  }

  let totalValue = 0, totalInvested = 0;
  assets.forEach(a => {
    const ltp      = getLTP(prices, a.instrument);
    totalValue    += (+a.qty || 0) * (ltp || +a.avg_cost || 0);
    totalInvested += (+a.qty || 0) * (+a.avg_cost || 0);
  });

  assets.forEach(a => {
    const ltp = getLTP(prices, a.instrument);
    if (!ltp) return;

    const qty         = +a.qty || 0;
    const curVal      = qty * ltp;
    const investedAmt = qty * (+a.avg_cost || 0);
    const gain        = curVal - investedAmt;
    const gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    const allocPct    = totalValue > 0 ? ((curVal / totalValue) * 100) : 0;

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

// ── Edit / Add Modal ──────────────────────────────────────────

let _editingAionionGoldId  = null;
let _editingAionionGoldQty = null;

function openAionionGoldEditModal(row) {
  const isAdd = !row;
  _editingAionionGoldId  = row?.id  || null;
  _editingAionionGoldQty = +row?.qty || 0;

  document.getElementById('aionion-gold-edit-modal-title').textContent = isAdd ? 'Add Gold ETF' : `Edit — ${row.instrument}`;

  const instrEl    = document.getElementById('age-instrument');
  instrEl.value    = row?.instrument ?? '';
  instrEl.readOnly = !isAdd;
  instrEl.style.background = isAdd ? '' : 'var(--surface2)';
  instrEl.style.color      = isAdd ? '' : 'var(--muted)';
  instrEl.style.cursor     = isAdd ? '' : 'not-allowed';

  document.getElementById('age-qty').value      = row?.qty      ?? '';
  document.getElementById('age-avg-cost').value = row?.avg_cost ?? '';

  const saveBtn = document.getElementById('aionion-gold-edit-save-btn');
  if (saveBtn) saveBtn.textContent = isAdd ? '💾 Add ETF' : '💾 Save Changes';

  document.getElementById('aionion-gold-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAionionGoldEditModal() {
  document.getElementById('aionion-gold-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAionionGoldId = null;
}

// ══════════════════════════════════════════════════════════════
//  EVENT WIRING  (all inside fragments-loaded)
// ══════════════════════════════════════════════════════════════

document.addEventListener('fragments-loaded', () => {

  // ── Actual Invested modal ──────────────────────────────────
  const modal = document.getElementById('aionion-gold-invested-modal');
  document.getElementById('aionion-gold-invested-add-btn')?.addEventListener('click',    () => openAgaiModal());
  document.getElementById('aionion-gold-invested-close-btn')?.addEventListener('click',  closeAgaiModal);
  document.getElementById('aionion-gold-invested-cancel-btn')?.addEventListener('click', closeAgaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeAgaiModal(); });

  document.getElementById('aionion-gold-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('agai-date').value;
    const amount = parseFloat(document.getElementById('agai-amount').value);
    if (!date)                  { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-gold-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
    const payload = { entry_date: date, amount };
    let op;
    if (_editingAgaiId) {
      op = sb.from('aionion_gold_actual_invested').update(payload).eq('id', _editingAgaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('aionion_gold_actual_invested').insert(payload);
    }
    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast(_editingAgaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success'); closeAgaiModal(); loadAionionGoldActualInvested(_currentUserId); }
  });

  // ── Refresh button ─────────────────────────────────────────
  document.getElementById('aionion-gold-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Aionion Gold') loadAssets(_currentUserId, 'Aionion Gold');
  });

  // ── Edit modal ─────────────────────────────────────────────
  const modal2 = document.getElementById('aionion-gold-edit-modal');
  document.getElementById('aionion-gold-edit-close-btn')?.addEventListener('click',  closeAionionGoldEditModal);
  document.getElementById('aionion-gold-edit-cancel-btn')?.addEventListener('click', closeAionionGoldEditModal);
  modal2?.addEventListener('click', e => { if (e.target === modal2) closeAionionGoldEditModal(); });

  document.getElementById('aionion-gold-edit-save-btn')?.addEventListener('click', async () => {
    const isAddMode  = !_editingAionionGoldId;
    const instrument = document.getElementById('age-instrument').value.trim().toUpperCase();
    if (isAddMode && !instrument) { showToast('Instrument symbol is required', 'error'); return; }

    const qty     = parseFloat(document.getElementById('age-qty').value);
    const avgCost = parseFloat(document.getElementById('age-avg-cost').value);
    if (!qty || qty <= 0)         { showToast('Quantity must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg Cost must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-gold-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    let error;
    if (isAddMode) {
      ({ error } = await sb.from('aionion_gold').insert({
        user_id: _currentUserId, instrument, qty, avg_cost: avgCost,
      }));
    } else {
      ({ error } = await sb.from('aionion_gold').update({ qty, avg_cost: avgCost }).eq('id', _editingAionionGoldId));
    }

    saveBtn.textContent = isAddMode ? '💾 Add ETF' : '💾 Save Changes';
    saveBtn.disabled    = false;

    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast(isAddMode ? 'ETF added 🎉' : 'Updated ✅', 'success'); closeAionionGoldEditModal(); loadAssets(_currentUserId, _currentAssetFilter); }
  });

  // ── Bulk-select for Actual Invested ───────────────────────
  (function() {
    var _sel = false;
    var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function _enter() {
      _sel = true;
      var btn = document.getElementById('aionion-gold-select-btn');
      if (btn) { btn.innerHTML = '✕ Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
      document.getElementById('aionion-gold-bulk-bar')?.classList.remove('hidden');
      document.querySelectorAll('.agai-cb-wrap').forEach(c => { c.style.display = ''; });
      _upd();
    }

    function _exit() {
      _sel = false;
      var btn = document.getElementById('aionion-gold-select-btn');
      if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
      document.getElementById('aionion-gold-bulk-bar')?.classList.add('hidden');
      document.getElementById('aionion-gold-bulk-normal').style.display = 'flex';
      document.getElementById('aionion-gold-bulk-confirm').style.display = 'none';
      document.querySelectorAll('.agai-cb-wrap').forEach(c => { c.style.display = 'none'; });
      document.querySelectorAll('.agai-cb').forEach(c => { c.checked = false; });
      _upd();
    }

    function _upd() {
      var n       = document.querySelectorAll('.agai-cb:checked').length;
      var countEl = document.getElementById('aionion-gold-bulk-count');
      var delBtn  = document.getElementById('aionion-gold-bulk-delete');
      if (countEl) countEl.textContent = n + ' selected';
      if (delBtn)  delBtn.disabled = n === 0;
    }

    document.getElementById('aionion-gold-select-btn')?.addEventListener('click', () => { if (_sel) _exit(); else _enter(); });
    document.getElementById('aionion-gold-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('aionion-gold-bulk-delete')?.addEventListener('click', () => {
      var n = document.querySelectorAll('.agai-cb:checked').length;
      if (!n) return;
      document.getElementById('aionion-gold-bulk-normal').style.display = 'none';
      document.getElementById('aionion-gold-bulk-confirm').style.display = 'flex';
      document.getElementById('aionion-gold-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('aionion-gold-bulk-no')?.addEventListener('click', () => {
      document.getElementById('aionion-gold-bulk-normal').style.display = 'flex';
      document.getElementById('aionion-gold-bulk-confirm').style.display = 'none';
    });

    document.getElementById('aionion-gold-bulk-yes')?.addEventListener('click', async () => {
      var checked = [...document.querySelectorAll('.agai-cb:checked')];
      if (!checked.length) return;
      var yesBtn = document.getElementById('aionion-gold-bulk-yes');
      yesBtn.textContent = 'Deleting…'; yesBtn.disabled = true;
      var anyErr = false;
      for (var cb of checked) {
        var r = await sb.from('aionion_gold_actual_invested').delete().eq('id', cb.dataset.id);
        if (r.error) { showToast('Delete failed: ' + r.error.message, 'error'); anyErr = true; }
      }
      yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
      if (!anyErr) showToast(checked.length + ' ' + (checked.length === 1 ? 'entry' : 'entries') + ' deleted', 'success');
      _exit();
      loadAionionGoldActualInvested(_currentUserId);
    });

    window['_aionionGold_bindCheckboxes'] = function() {
      document.querySelectorAll('.agai-cb').forEach(cb => { cb.addEventListener('change', _upd); });
      document.querySelectorAll('.agai-cb-wrap').forEach(c => { c.style.display = _sel ? '' : 'none'; });
      if (_sel) _upd();
    };
  })();

});