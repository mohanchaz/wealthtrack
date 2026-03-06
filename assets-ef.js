// ══════════════════════════════════════════════════════════════
//  EMERGENCY FUNDS ACTUAL INVESTED  — manual entries from ef_actual_invested
// ══════════════════════════════════════════════════════════════

let _editingEfInvestedId = null;

async function loadEfActualInvested(userId) {
  const section = document.getElementById('ef-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('ef-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('ef_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderEfActualInvested(data || []);
}

function renderEfActualInvested(rows) {
  const body2 = document.getElementById('ef-monthly-body2');
  const totalEl = document.getElementById('ef-monthly-total');
  if (!body2) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${INR(grand)}`;

  // Also update the stat tile and gain/loss on the assets page
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
    body2.innerHTML = `<tr><td colspan="3" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>`;
    return;
  }

  body2.innerHTML = rows.map((r, i) => {
    const d = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
        <td class="efi-cb-wrap" data-id="${r.id}" style="width:28px;padding:0 8px;display:none;border-bottom:1px solid var(--border)"><input type="checkbox" class="efi-cb" data-id="${r.id}" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488"></td>
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-efi-id="${r.id}" data-efi-date="${r.entry_date}" data-efi-amount="${r.amount}" class="efi-edit-btn" title="Edit">✏️</button></span>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;


  if (window['_ef_bindCheckboxes']) window['_ef_bindCheckboxes']();
  body2.querySelectorAll('.efi-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEfInvestedModal({
      id: btn.dataset.efiId, entry_date: btn.dataset.efiDate,
      amount: btn.dataset.efiAmount
    }));
  });
}

function openEfInvestedModal(row = null) {
  _editingEfInvestedId = row?.id || null;
  const titleEl = document.getElementById('ef-invested-modal-title');
  const saveBtn = document.getElementById('ef-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '💾 Save Entry';
  document.getElementById('efi-date').value = row?.entry_date || '';
  document.getElementById('efi-amount').value = row?.amount || '';
  document.getElementById('ef-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeEfInvestedModal() {
  document.getElementById('ef-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingEfInvestedId = null;
}

async function deleteEfInvested(id) {
  const { error } = await sb.from('ef_actual_invested').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Entry deleted', 'success');
  loadEfActualInvested(_currentUserId);
}

// ══════════════════════════════════════════════════════════════

// Wire up ef-invested-modal events
document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('ef-invested-modal');
  document.getElementById('ef-invested-add-btn')?.addEventListener('click', () => openEfInvestedModal());
  document.getElementById('ef-invested-close-btn')?.addEventListener('click', closeEfInvestedModal);
  document.getElementById('ef-invested-cancel-btn')?.addEventListener('click', closeEfInvestedModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeEfInvestedModal(); });

  document.getElementById('ef-invested-save-btn')?.addEventListener('click', async () => {
    const date = document.getElementById('efi-date').value;
    const amount = parseFloat(document.getElementById('efi-amount').value);

    if (!date) { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn2 = document.getElementById('ef-invested-save-btn');
    saveBtn2.textContent = 'Saving…'; saveBtn2.disabled = true;

    const payload = { entry_date: date, amount };
    let op;
    if (_editingEfInvestedId) {
      op = sb.from('ef_actual_invested').update(payload).eq('id', _editingEfInvestedId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('ef_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn2.textContent = '💾 Save Entry'; saveBtn2.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingEfInvestedId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeEfInvestedModal();
      loadEfActualInvested(_currentUserId);
    }
  });

});
// ── Actual Invested bulk-select wiring for ef ─────────────────
(function() {
  var _sel = false;
  var SEL_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function _enter() {
    _sel = true;
    var btn = document.getElementById('ef-select-btn');
    if (btn) { btn.innerHTML = '\u2715 Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
    document.getElementById('ef-bulk-bar')?.classList.remove('hidden');
    document.querySelectorAll('.efi-cb-wrap').forEach(function(c) { c.style.display = ''; });
    _upd();
  }

  function _exit() {
    _sel = false;
    var btn = document.getElementById('ef-select-btn');
    if (btn) { btn.innerHTML = SEL_ICON + ' Select'; btn.style.background = 'rgba(20,184,166,0.1)'; btn.style.borderColor = 'rgba(20,184,166,0.3)'; btn.style.color = '#0d9488'; }
    document.getElementById('ef-bulk-bar')?.classList.add('hidden');
    document.getElementById('ef-bulk-normal').style.display = 'flex';
    document.getElementById('ef-bulk-confirm').style.display = 'none';
    document.querySelectorAll('.efi-cb-wrap').forEach(function(c) { c.style.display = 'none'; });
    document.querySelectorAll('.efi-cb').forEach(function(c) { c.checked = false; });
    _upd();
  }

  function _upd() {
    var n = document.querySelectorAll('.efi-cb:checked').length;
    var countEl = document.getElementById('ef-bulk-count');
    var delBtn = document.getElementById('ef-bulk-delete');
    if (countEl) countEl.textContent = n + ' selected';
    if (delBtn) delBtn.disabled = n === 0;
  }


    document.getElementById('ef-select-btn')?.addEventListener('click', function() {
      if (_sel) _exit(); else _enter();
    });
    document.getElementById('ef-bulk-cancel')?.addEventListener('click', _exit);

    document.getElementById('ef-bulk-delete')?.addEventListener('click', function() {
      var n = document.querySelectorAll('.efi-cb:checked').length;
      if (!n) return;
      document.getElementById('ef-bulk-normal').style.display = 'none';
      document.getElementById('ef-bulk-confirm').style.display = 'flex';
      document.getElementById('ef-bulk-confirm-count').textContent = n === 1 ? '1 entry' : n + ' entries';
    });

    document.getElementById('ef-bulk-no')?.addEventListener('click', function() {
      document.getElementById('ef-bulk-normal').style.display = 'flex';
      document.getElementById('ef-bulk-confirm').style.display = 'none';
    });

    document.getElementById('ef-bulk-yes')?.addEventListener('click', async function() {
      var checked = [...document.querySelectorAll('.efi-cb:checked')];
      if (!checked.length) return;
      var yesBtn = document.getElementById('ef-bulk-yes');
      yesBtn.textContent = 'Deleting\u2026'; yesBtn.disabled = true;
      var anyErr = false;
      for (var cb of checked) {
        var r = await sb.from('ef_actual_invested').delete().eq('id', cb.dataset.id);
        if (r.error) { showToast('Delete failed: ' + r.error.message, 'error'); anyErr = true; }
      }
      yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
      if (!anyErr) showToast(checked.length + ' ' + (checked.length === 1 ? 'entry' : 'entries') + ' deleted', 'success');
      _exit();
      loadEfActualInvested(_currentUserId);
    });


  // Called after each render to re-wire checkboxes
  window['_ef_bindCheckboxes'] = function() {
    document.querySelectorAll('.efi-cb').forEach(function(cb) {
      cb.addEventListener('change', _upd);
    });
    // Hide all checkbox cells by default unless in select mode
    document.querySelectorAll('.efi-cb-wrap').forEach(function(c) {
      c.style.display = _sel ? '' : 'none';
    });
    if (_sel) _upd();
  };
})();