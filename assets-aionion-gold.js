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
  if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('aionion_gold_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
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
          data-agai-id="${r.id}" data-agai-date="${r.entry_date}" data-agai-amount="${r.amount}" data-agai-notes="${r.notes || ''}"
          class="agai-edit-btn" title="Edit">✏️</button>
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7"
          data-agai-id="${r.id}" class="agai-delete-btn" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  body.querySelectorAll('.agai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openAgaiModal({
      id: btn.dataset.agaiId, entry_date: btn.dataset.agaiDate,
      amount: btn.dataset.agaiAmount, notes: btn.dataset.agaiNotes
    }));
  });
  body.querySelectorAll('.agai-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      const { error } = await sb.from('aionion_gold_actual_invested').delete().eq('id', btn.dataset.agaiId);
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
      showToast('Entry deleted', 'success');
      loadAionionGoldActualInvested(_currentUserId);
    });
  });
}

function openAgaiModal(row = null) {
  _editingAgaiId = row?.id || null;
  const titleEl = document.getElementById('aionion-gold-invested-modal-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  document.getElementById('agai-date').value   = row?.entry_date || '';
  document.getElementById('agai-amount').value = row?.amount    || '';
  document.getElementById('agai-notes').value  = row?.notes     || '';
  document.getElementById('aionion-gold-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAgaiModal() {
  document.getElementById('aionion-gold-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingAgaiId = null;
}

document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('aionion-gold-invested-modal');
  document.getElementById('aionion-gold-invested-add-btn')?.addEventListener('click',    () => openAgaiModal());
  document.getElementById('aionion-gold-invested-close-btn')?.addEventListener('click',  closeAgaiModal);
  document.getElementById('aionion-gold-invested-cancel-btn')?.addEventListener('click', closeAgaiModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeAgaiModal(); });

  document.getElementById('aionion-gold-invested-save-btn')?.addEventListener('click', async () => {
    const date   = document.getElementById('agai-date').value;
    const amount = parseFloat(document.getElementById('agai-amount').value);
    const notes  = document.getElementById('agai-notes').value.trim() || null;

    if (!date)                  { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('aionion-gold-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount, notes };
    let op;
    if (_editingAgaiId) {
      op = sb.from('aionion_gold_actual_invested').update(payload).eq('id', _editingAgaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('aionion_gold_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingAgaiId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeAgaiModal();
      loadAionionGoldActualInvested(_currentUserId);
    }
  });
});

// ── Live Price Refresh ────────────────────────────────────────

async function fetchAndRefreshAionionGoldPrices(assets) {
  const lastUpdateEl = document.getElementById('aionion-gold-last-updated');
  const refreshBtn   = document.getElementById('aionion-gold-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '🔄 Fetching live prices…';
  if (refreshBtn)   refreshBtn.disabled = true;

  const instruments = assets.map(a => a.instrument);
  const prices = await fetchLivePrices(instruments);

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '⚠️ Could not fetch prices';
    showToast('Live price fetch failed', 'error');
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

document.addEventListener('fragments-loaded', () => {
  document.getElementById('aionion-gold-refresh-btn')?.addEventListener('click', () => {
    if (_currentAssetFilter === 'Aionion Gold') loadAssets(_currentUserId, 'Aionion Gold');
  });
});

// ── Edit / Add Modal ──────────────────────────────────────────

let _editingAionionGoldId  = null;
let _editingAionionGoldQty = null;

function openAionionGoldEditModal(row) {
  const isAdd = !row;
  _editingAionionGoldId  = row?.id  || null;
  _editingAionionGoldQty = +row?.qty || 0;

  document.getElementById('aionion-gold-edit-modal-title').textContent = isAdd ? 'Add Gold ETF' : `Edit — ${row.instrument}`;

  const instrEl = document.getElementById('age-instrument');
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

document.addEventListener('fragments-loaded', () => {
  document.getElementById('aionion-gold-edit-close-btn')?.addEventListener('click', closeAionionGoldEditModal);
  document.getElementById('aionion-gold-edit-cancel-btn')?.addEventListener('click', closeAionionGoldEditModal);
  document.getElementById('aionion-gold-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('aionion-gold-edit-modal')) closeAionionGoldEditModal();
  });

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
    saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(isAddMode ? 'ETF added 🎉' : 'Updated ✅', 'success');
      closeAionionGoldEditModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });
});
