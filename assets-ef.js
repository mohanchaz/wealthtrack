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
  const body = document.getElementById('ef-monthly-body');
  const totalEl = document.getElementById('ef-monthly-total');
  if (!body) return;

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
    body.innerHTML = `<tr><td colspan="3" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-efi-id="${r.id}" data-efi-date="${r.entry_date}" data-efi-amount="${r.amount}" class="efi-edit-btn" title="Edit">✏️</button>
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-efi-id="${r.id}" class="efi-delete-btn" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  body.querySelectorAll('.efi-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEfInvestedModal({
      id: btn.dataset.efiId, entry_date: btn.dataset.efiDate,
      amount: btn.dataset.efiAmount
    }));
  });
  body.querySelectorAll('.efi-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      await deleteEfInvested(btn.dataset.efiId);
    });
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

    const saveBtn = document.getElementById('ef-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount };
    let op;
    if (_editingEfInvestedId) {
      op = sb.from('ef_actual_invested').update(payload).eq('id', _editingEfInvestedId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('ef_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingEfInvestedId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeEfInvestedModal();
      loadEfActualInvested(_currentUserId);
    }
  });
});