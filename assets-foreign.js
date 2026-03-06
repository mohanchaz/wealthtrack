// ══════════════════════════════════════════════════════════════
//  FOREIGN STOCKS  — foreign_stock_holdings
//  MKS → GBX (pence, ÷100 for GBP display); all others → USD
// ══════════════════════════════════════════════════════════════

const GBX_SYMBOLS = ['MKS'];

// ── Render table ──────────────────────────────────────────────

function renderForeignStocks(rows) {
  const tbody = document.getElementById('assets-table-body');
  const thead = document.getElementById('assets-thead-row');
  if (!tbody) return;

  if (thead) {
    thead.innerHTML = `
      <th>Symbol</th>
      <th style="text-align:right">Quantity</th>
      <th style="text-align:right">Avg Price</th>
      <th style="text-align:center">Currency</th>
      <th style="text-align:right">Value (orig.)</th>
      <th></th>`;
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--muted2)">
      No foreign holdings yet — click <b>📥 Import CSV</b> to add
    </td></tr>`;
    ['assets-total-invested','assets-total-value','assets-total-gain'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    return;
  }

  let totalUSD = 0, totalGBP = 0;

  tbody.innerHTML = rows.map((r, i) => {
    const isGBX     = r.currency === 'GBX';
    const dispPrice = isGBX ? r.avg_price / 100 : r.avg_price;
    const ccy       = isGBX ? 'GBP' : 'USD';
    const value     = r.qty * dispPrice;
    if (isGBX) totalGBP += value; else totalUSD += value;

    const badge = `<span style="background:${isGBX ? '#e8f4fd' : '#e8fdf0'};color:${isGBX ? '#1a6fa8' : '#15803d'};padding:1px 9px;border-radius:20px;font-size:11px;font-weight:600">${ccy}</span>`;

    return `<tr data-id="${r.id}" style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid var(--border)">${r.symbol}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums">${(+r.qty).toFixed(4)}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums">${dispPrice.toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid var(--border)">${badge}</td>
      <td style="padding:10px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums">${ccy} ${value.toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid var(--border)">
        <button class="foreign-edit-btn" data-id="${r.id}"
          style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 5px;opacity:0.65;transition:opacity 0.15s"
          onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.65" title="Edit">✏️</button>
      </td>
    </tr>`;
  }).join('');

  // Wire edit buttons
  tbody.querySelectorAll('.foreign-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => r.id === btn.dataset.id);
      if (row) openForeignEditModal(row);
    });
  });

  // Summary stats
  const parts = [];
  if (totalUSD) parts.push(`USD ${totalUSD.toFixed(2)}`);
  if (totalGBP) parts.push(`GBP ${totalGBP.toFixed(2)}`);
  const totalStr = parts.join('  +  ') || '—';

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('assets-total-invested', totalStr);
  setEl('assets-total-value',    totalStr);
  setEl('assets-total-gain',     '—');
  const countEl = document.getElementById('assets-count-inline');
  if (countEl) countEl.textContent = `${rows.length} holding${rows.length !== 1 ? 's' : ''}`;
}

// ── Load ──────────────────────────────────────────────────────

async function loadForeignStocks(userId) {
  const tbody = document.getElementById('assets-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('foreign_stock_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('symbol', { ascending: true });

  if (error) { showToast('Failed to load foreign stocks: ' + error.message, 'error'); return; }
  renderForeignStocks(data || []);
}

// ── Edit modal ────────────────────────────────────────────────

let _editingForeignId = null;

function openForeignEditModal(row) {
  _editingForeignId = row ? row.id : null;
  const titleEl = document.getElementById('foreign-edit-title');
  if (titleEl) titleEl.textContent = row ? 'Edit Holding' : 'Add Holding';
  document.getElementById('foreign-edit-symbol').value   = row?.symbol    || '';
  document.getElementById('foreign-edit-qty').value      = row?.qty       || '';
  document.getElementById('foreign-edit-price').value    = row?.avg_price || '';
  document.getElementById('foreign-edit-currency').value = row?.currency  || 'USD';
  document.getElementById('foreign-edit-modal').classList.remove('hidden');
}

function closeForeignEditModal() {
  _editingForeignId = null;
  document.getElementById('foreign-edit-modal').classList.add('hidden');
}

// ── CSV parser ────────────────────────────────────────────────

function parseForeignCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const iSym = header.findIndex(h => h === 'symbol');
  const iQty = header.findIndex(h => h.includes('quantity') || h === 'qty');
  const iPrc = header.findIndex(h => h.includes('avg_price') || h.includes('avg price') || h === 'price');

  if (iSym < 0 || iQty < 0 || iPrc < 0) return null;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const sym  = (cols[iSym] || '').trim().toUpperCase();
    const qty  = parseFloat(cols[iQty]);
    const prc  = parseFloat(cols[iPrc]);
    if (!sym || isNaN(qty) || isNaN(prc)) continue;
    rows.push({ symbol: sym, qty, avg_price: prc, currency: GBX_SYMBOLS.includes(sym) ? 'GBX' : 'USD' });
  }
  return rows;
}

// ── Fragment-loaded wiring ────────────────────────────────────

document.addEventListener('fragments-loaded', () => {

  // ── Import modal ────────────────────────────────────────────
  let _parsedForeignRows = [];

  const csvInput    = document.getElementById('foreign-csv-input');
  const previewSec  = document.getElementById('foreign-preview-section');
  const previewBody = document.getElementById('foreign-preview-body');
  const countBadge  = document.getElementById('foreign-stock-count');
  const importCount = document.getElementById('foreign-import-count');
  const confirmBtn  = document.getElementById('foreign-import-confirm-btn');
  const fileLabel   = document.getElementById('foreign-csv-filename');

  csvInput?.addEventListener('change', () => {
    const file = csvInput.files[0];
    if (!file) return;
    if (fileLabel) fileLabel.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseForeignCSV(e.target.result);
      if (!rows) { showToast('Cannot parse CSV — expected: symbol, quantity, avg_price', 'error'); return; }
      _parsedForeignRows = rows;
      if (countBadge)  countBadge.textContent = rows.length;
      if (importCount) importCount.textContent = rows.length;
      confirmBtn?.classList.remove('hidden');
      previewSec?.classList.remove('hidden');

      if (previewBody) {
        previewBody.innerHTML = rows.map((r, i) => {
          const ccy = r.currency === 'GBX' ? 'GBP' : 'USD';
          return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
            <td style="padding:7px 14px;font-weight:700;border-bottom:1px solid var(--border)">${r.symbol}</td>
            <td style="padding:7px 14px;text-align:right;border-bottom:1px solid var(--border)">${r.qty.toFixed(4)}</td>
            <td style="padding:7px 14px;text-align:right;border-bottom:1px solid var(--border)">${r.avg_price.toFixed(2)}</td>
            <td style="padding:7px 14px;text-align:center;border-bottom:1px solid var(--border)">
              <span style="background:${r.currency === 'GBX' ? '#e8f4fd' : '#e8fdf0'};color:${r.currency === 'GBX' ? '#1a6fa8' : '#15803d'};padding:1px 9px;border-radius:20px;font-size:11px;font-weight:600">${ccy}</span>
            </td>
          </tr>`;
        }).join('');
      }
    };
    reader.readAsText(file);
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!_parsedForeignRows.length || !_currentUserId) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing…';

    const { error: delErr } = await sb.from('foreign_stock_holdings').delete().eq('user_id', _currentUserId);
    if (delErr) {
      showToast('Delete failed: ' + delErr.message, 'error');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `📥 Import <span id="foreign-import-count">${_parsedForeignRows.length}</span> Holdings`;
      return;
    }

    const { error: insErr } = await sb.from('foreign_stock_holdings').insert(
      _parsedForeignRows.map(r => ({ user_id: _currentUserId, symbol: r.symbol, qty: r.qty, avg_price: r.avg_price, currency: r.currency }))
    );
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `📥 Import <span id="foreign-import-count">${_parsedForeignRows.length}</span> Holdings`;
    if (insErr) { showToast('Import failed: ' + insErr.message, 'error'); return; }
    showToast(`${_parsedForeignRows.length} foreign holdings imported ✅`, 'success');
    closeForeignImportModal();
    loadForeignStocks(_currentUserId);
  });

  document.getElementById('foreign-import-close-btn')?.addEventListener('click',  closeForeignImportModal);
  document.getElementById('foreign-import-cancel-btn')?.addEventListener('click', closeForeignImportModal);
  document.getElementById('foreign-import-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foreign-import-modal')) closeForeignImportModal();
  });

  // ── Edit modal ──────────────────────────────────────────────
  document.getElementById('foreign-edit-close-btn')?.addEventListener('click',  closeForeignEditModal);
  document.getElementById('foreign-edit-cancel-btn')?.addEventListener('click', closeForeignEditModal);
  document.getElementById('foreign-edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foreign-edit-modal')) closeForeignEditModal();
  });

  document.getElementById('foreign-edit-save-btn')?.addEventListener('click', async () => {
    const symbol   = document.getElementById('foreign-edit-symbol').value.trim().toUpperCase();
    const qty      = parseFloat(document.getElementById('foreign-edit-qty').value);
    const avgPrice = parseFloat(document.getElementById('foreign-edit-price').value);
    const currency = document.getElementById('foreign-edit-currency').value;

    if (!symbol)                    { showToast('Symbol is required', 'error'); return; }
    if (isNaN(qty)      || qty <= 0)  { showToast('Quantity must be > 0', 'error'); return; }
    if (isNaN(avgPrice) || avgPrice <= 0) { showToast('Avg price must be > 0', 'error'); return; }

    const saveBtn = document.getElementById('foreign-edit-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { symbol, qty, avg_price: avgPrice, currency };
    let error;
    if (_editingForeignId) {
      ({ error } = await sb.from('foreign_stock_holdings').update(payload).eq('id', _editingForeignId));
    } else {
      ({ error } = await sb.from('foreign_stock_holdings').insert({ ...payload, user_id: _currentUserId }));
    }
    saveBtn.textContent = '💾 Save'; saveBtn.disabled = false;
    if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
    showToast(_editingForeignId ? 'Updated ✅' : 'Added 🎉', 'success');
    closeForeignEditModal();
    loadForeignStocks(_currentUserId);
  });

  // Toolbar button
  document.getElementById('foreign-import-btn')?.addEventListener('click', openForeignImportModal);
});

function openForeignImportModal() {
  const csvInput = document.getElementById('foreign-csv-input');
  if (csvInput) csvInput.value = '';
  const fileLabel = document.getElementById('foreign-csv-filename');
  if (fileLabel) fileLabel.textContent = '';
  document.getElementById('foreign-preview-section')?.classList.add('hidden');
  document.getElementById('foreign-import-confirm-btn')?.classList.add('hidden');
  document.getElementById('foreign-import-modal').classList.remove('hidden');
}

function closeForeignImportModal() {
  document.getElementById('foreign-import-modal').classList.add('hidden');
}
