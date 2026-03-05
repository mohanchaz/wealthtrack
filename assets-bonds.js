// ══════════════════════════════════════════════════════════════
//  BONDS — manual entry, edit, delete
// ══════════════════════════════════════════════════════════════

let _editingBondId = null;

function openBondModal(row = null) {
  _editingBondId = row ? (row.id || null) : null;
  const title = document.getElementById('bonds-edit-modal-title');
  if (title) title.textContent = row ? 'Edit Bond' : 'Add Bond';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('bond-name',          row?.name);
  set('bond-platform',      row?.platform);
  set('bond-isin',          row?.isin);
  set('bond-id-field',      row?.bond_id);
  set('bond-sb-account',    row?.sb_account_number);
  set('bond-invested',      row?.invested);
  set('bond-face-value',    row?.face_value);
  set('bond-interest',      row?.interest_rate);
  set('bond-purchase-date', row?.purchase_date);
  set('bond-maturity-date', row?.maturity_date);

  document.getElementById('bonds-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBondModal() {
  document.getElementById('bonds-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingBondId = null;
}

document.addEventListener('fragments-loaded', () => {
  document.getElementById('bonds-edit-close-btn')?.addEventListener('click', closeBondModal);
  document.getElementById('bonds-edit-cancel-btn')?.addEventListener('click', closeBondModal);
  document.getElementById('bonds-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('bonds-edit-modal')) closeBondModal();
  });

  document.getElementById('bonds-edit-save-btn')?.addEventListener('click', async () => {
    const name        = document.getElementById('bond-name').value.trim();
    const platform    = document.getElementById('bond-platform').value.trim();
    const isin        = document.getElementById('bond-isin').value.trim();
    const bond_id     = document.getElementById('bond-id-field').value.trim();
    const sb_account  = document.getElementById('bond-sb-account').value.trim();
    const invested    = parseFloat(document.getElementById('bond-invested').value);
    const face_value  = parseFloat(document.getElementById('bond-face-value').value);
    const interest    = parseFloat(document.getElementById('bond-interest').value);
    const purchase_dt = document.getElementById('bond-purchase-date').value;
    const maturity_dt = document.getElementById('bond-maturity-date').value;

    if (!name)                    { showToast('Name is required', 'error'); return; }
    if (!invested || invested<=0) { showToast('Invested amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('bonds-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = {
      name,
      platform:          platform || null,
      isin:              isin     || null,
      bond_id:           bond_id  || null,
      sb_account_number: sb_account || null,
      invested,
      current_value:     invested,   // no live price — mirrors invested
      face_value:        isNaN(face_value)  ? null : face_value,
      interest_rate:     isNaN(interest)    ? null : interest,
      purchase_date:     purchase_dt || null,
      maturity_date:     maturity_dt || null,
    };

    let op;
    if (_editingBondId) {
      op = sb.from('bonds').update(payload).eq('id', _editingBondId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('bonds').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingBondId ? 'Bond updated ✅' : 'Bond added 🎉', 'success');
      closeBondModal();
      loadAssets(_currentUserId, 'Bonds');
    }
  });
});
