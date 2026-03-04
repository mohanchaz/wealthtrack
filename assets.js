async function loadDashboardStats(userId) {
  let totalInvested = 0, totalValue = 0, count = 0;

  // zerodha_stocks doesn't store invested/current_value — must compute from qty * avg_cost / ltp
  const nonZerodhaTables = Object.entries(ASSET_TABLES)
    .filter(([, t]) => t !== 'zerodha_stocks').map(([, t]) => t);
  const hasZerodha = Object.values(ASSET_TABLES).includes('zerodha_stocks');

  const [assetResults, zerodhaResult, { data: fdData }, { data: zaiData }] = await Promise.all([
    Promise.all(nonZerodhaTables.map(table =>
      sb.from(table).select('invested, current_value').eq('user_id', userId)
    )),
    hasZerodha
      ? sb.from('zerodha_stocks').select('qty, avg_cost, ltp').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
    sb.from('fd_actual_invested').select('amount').eq('user_id', userId),
    sb.from('zerodha_actual_invested').select('amount').eq('user_id', userId)
  ]);

  assetResults.forEach(({ data }) => {
    if (!data) return;
    data.forEach(row => {
      totalInvested += +row.invested || 0;
      totalValue += +row.current_value || 0;
      count++;
    });
  });

  (zerodhaResult.data || []).forEach(row => {
    const qty = +row.qty || 0;
    totalInvested += qty * (+row.avg_cost || 0);
    totalValue += qty * (+row.ltp || 0);
    count++;
  });

  const fdActual = (fdData || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const zaiActual = (zaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const actualInvested = fdActual + zaiActual;
  const fdCount = (fdData || []).length;
  const zaiCount = (zaiData || []).length;
  const entryLabel = `${fdCount} FD · ${zaiCount} Zerodha entr${(fdCount + zaiCount) !== 1 ? 'ies' : 'y'}`;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dash-net-worth', INR(totalValue));
  set('dash-net-worth-sub', count ? `${count} asset${count > 1 ? 's' : ''} tracked` : 'Add assets to calculate');
  set('dash-total-assets', INR(totalValue));
  set('dash-total-assets-sub', `${count} asset${count > 1 ? 's' : ''} tracked`);
  set('dash-actual-invested', INR(actualInvested));
  set('dash-actual-invested-sub', entryLabel);
}

async function loadAssets(userId, filter = null) {
  const tbody = document.getElementById('assets-table-body');
  const addBtn = document.getElementById('add-asset-btn');
  const toolbarLabel = document.getElementById('assets-toolbar-label');

  tbody.innerHTML = `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">⏳</div>Loading…</div></td></tr>`;

  // Update subtitle
  const subtitle = document.querySelector('#page-assets .page-subtitle');

  if (!filter) {
    _currentAssetTable = null;
    _currentAssetFilter = null;
    if (subtitle) subtitle.textContent = 'Your assets overview';
    if (toolbarLabel) toolbarLabel.textContent = 'Select a category from the sidebar to view assets';
    if (addBtn) addBtn.classList.add('hidden');

    // Hide the Actual Invested sections on overview
    const monthlySec = document.getElementById('assets-monthly-summary');
    const zerodhaSec = document.getElementById('zerodha-monthly-summary');
    if (monthlySec) monthlySec.classList.add('hidden');
    if (zerodhaSec) zerodhaSec.classList.add('hidden');

    // Hide the whole layout row on overview — only stat tiles visible
    // (toolbar is inside the layout row so no need to hide it separately)
    const layoutRow = document.getElementById('assets-layout-row');
    if (layoutRow) layoutRow.classList.add('hidden');

    // Hide the Actual Invested stat card and reset table headers to default
    const actualOverviewCard = document.getElementById('assets-actual-invested-card');
    if (actualOverviewCard) actualOverviewCard.classList.add('hidden');
    const overviewThead = document.getElementById('assets-thead-row');
    if (overviewThead) {
      const defaultCols = ASSET_COLUMNS['cash_assets'];
      overviewThead.innerHTML =
        defaultCols.map(c => `<th${c.align ? ` style="text-align:${c.align}"` : ''}>${c.label}</th>`).join('') +
        `<th style="text-align:right">Gain / Loss</th><th></th>`;
    }

    // Aggregate totals from all known asset tables
    // zerodha_stocks doesn't store invested/current_value — compute from qty * avg_cost / ltp
    let totalInvested = 0, totalValue = 0, count = 0;

    const nonZerodhaTables = Object.entries(ASSET_TABLES)
      .filter(([, t]) => t !== 'zerodha_stocks').map(([, t]) => t);
    const hasZerodha = Object.values(ASSET_TABLES).includes('zerodha_stocks');

    const [otherResults, zerodhaResult] = await Promise.all([
      Promise.all(nonZerodhaTables.map(t =>
        sb.from(t).select('invested, current_value').eq('user_id', userId)
      )),
      hasZerodha
        ? sb.from('zerodha_stocks').select('qty, avg_cost, ltp').eq('user_id', userId)
        : Promise.resolve({ data: [] })
    ]);

    otherResults.forEach(({ data }) => {
      if (!data) return;
      data.forEach(row => {
        totalInvested += +row.invested || 0;
        totalValue += +row.current_value || 0;
        count++;
      });
    });

    (zerodhaResult.data || []).forEach(row => {
      const qty = +row.qty || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue += qty * (+row.ltp || 0);
      count++;
    });

    const gain = totalValue - totalInvested;
    const gainPct = totalInvested > 0 ? ` (${((gain / totalInvested) * 100).toFixed(1)}%)` : '';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('assets-total-invested', INR(totalInvested));
    set('assets-total-value', INR(totalValue));
    set('assets-count', count);
    const gainEl = document.getElementById('assets-total-gain');
    if (gainEl) {
      gainEl.textContent = (gain >= 0 ? '+' : '') + INR(gain) + gainPct;
      gainEl.style.color = gain > 0 ? 'var(--green)' : gain < 0 ? 'var(--danger)' : 'var(--muted)';
    }

    // Also fetch both actual_invested totals for the Actual Invested tile
    const [{ data: fdData2 }, { data: zaiData2 }] = await Promise.all([
      sb.from('fd_actual_invested').select('amount').eq('user_id', userId),
      sb.from('zerodha_actual_invested').select('amount').eq('user_id', userId)
    ]);
    const actualInvested =
      (fdData2 || []).reduce((s, r) => s + (+r.amount || 0), 0) +
      (zaiData2 || []).reduce((s, r) => s + (+r.amount || 0), 0);
    set('assets-actual-invested', INR(actualInvested));

    // Clear the spinner — show "select a category" prompt
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="assets-empty">
        <div class="empty-icon">👈</div>
        Pick a category from the sidebar<br/>
        <span style="font-size:12px;color:var(--muted2)">e.g. Assets → Cash</span>
      </div></td></tr>`;
    return;
  }

  const tableName = ASSET_TABLES[filter];
  if (!tableName) {
    if (addBtn) addBtn.classList.add('hidden');
    tbody.innerHTML = `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">🚧</div>${filter} — coming soon!</div></td></tr>`;
    return;
  }

  _currentAssetTable = tableName;
  _currentAssetFilter = filter;
  if (subtitle) subtitle.textContent = `💵 ${filter}`;
  if (toolbarLabel) toolbarLabel.textContent = `Showing ${filter} assets`;
  if (addBtn) addBtn.classList.remove('hidden');

  // Show layout row when a category is selected
  const activeLayoutRow = document.getElementById('assets-layout-row');
  if (activeLayoutRow) activeLayoutRow.classList.remove('hidden');

  const orderCol = tableName === 'zerodha_stocks' ? 'instrument' : 'created_at';
  const orderAsc = tableName === 'zerodha_stocks';

  const { data, error } = await sb
    .from(tableName)
    .select('*')
    .eq('user_id', userId)
    .order(orderCol, { ascending: orderAsc });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">⚠️</div>${error.message}</div></td></tr>`;
    return;
  }

  renderAssetsTable(data || [], tableName);
}

function renderAssetsTable(assets, tableName) {
  const tbody = document.getElementById('assets-table-body');
  const thead = document.getElementById('assets-thead-row');

  // Get column config (default to cash layout)
  const cols = ASSET_COLUMNS[tableName] || ASSET_COLUMNS['cash_assets'];
  const colCount = cols.length + 2; // +gain +delete

  // Show/hide Import CSV and Refresh Prices buttons
  const importBtn = document.getElementById('zerodha-import-btn');
  const refreshBtn = document.getElementById('zerodha-refresh-btn');
  const lastUpdated = document.getElementById('zerodha-last-updated');
  const addBtn2 = document.getElementById('add-asset-btn');
  if (tableName === 'zerodha_stocks') {
    if (importBtn) importBtn.classList.remove('hidden');
    if (refreshBtn) refreshBtn.classList.remove('hidden');
    if (lastUpdated) lastUpdated.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.add('hidden');
  } else {
    if (importBtn) importBtn.classList.add('hidden');
    if (refreshBtn) refreshBtn.classList.add('hidden');
    if (lastUpdated) lastUpdated.classList.add('hidden');
  }

  // Update thead dynamically
  if (thead) {
    thead.innerHTML =
      cols.map(c => `<th${c.align ? ` style="text-align:${c.align}"` : ''}>${c.label}</th>`).join('') +
      `<th style="text-align:right">Gain / Loss</th><th></th>`;
  }

  // Summary stats
  // For zerodha_stocks, invested/current_value are not stored — compute from qty * avg_cost / ltp
  const totalInvested = tableName === 'zerodha_stocks'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
    : assets.reduce((s, a) => s + (+a.invested || 0), 0);
  const totalValue = tableName === 'zerodha_stocks'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.ltp || 0)), 0)
    : assets.reduce((s, a) => s + (+a.current_value || 0), 0);
  const totalGain = totalValue - totalInvested;

  document.getElementById('assets-total-invested').textContent = INR(totalInvested);
  document.getElementById('assets-total-value').textContent = INR(totalValue);
  document.getElementById('assets-count').textContent = assets.length;

  const gainEl = document.getElementById('assets-total-gain');
  const totalGainPct = totalInvested > 0 ? ` (${((totalGain / totalInvested) * 100).toFixed(1)}%)` : '';
  gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + totalGainPct;
  gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';

  if (!assets.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}">
      <div class="assets-empty">
        <div class="empty-icon">${tableName === 'zerodha_stocks' ? '📂' : '🏦'}</div>
        ${tableName === 'zerodha_stocks'
        ? 'No holdings yet — click <b>📥 Import CSV</b> to import your Zerodha portfolio'
        : 'No entries yet.<br/>Click <b>+ Add Asset</b> to get started.'}
      </div></td></tr>`;
    return;
  }

  let html = '';
  assets.forEach(a => {
    // Inject virtual fields for Zerodha Stocks — all computed from stored qty, avg_cost, ltp
    const row = tableName === 'zerodha_stocks'
      ? {
        ...a,
        _qty_diff: (+a.qty || 0) - (+a.prev_qty || 0),
        invested: (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.ltp || 0),
        _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.ltp || 0)) / totalValue) * 100 : 0,
      }
      : a;

    const invested = +row.invested || 0;
    const current = +row.current_value || 0;
    const gain = current - invested;
    const gainPct = invested > 0 ? ((gain / invested) * 100).toFixed(1) : null;

    let badgeCls = 'zero', arrow = '–';
    if (gain > 0) { badgeCls = 'pos'; arrow = '▲'; }
    if (gain < 0) { badgeCls = 'neg'; arrow = '▼'; }

    const gainLabel = gain !== 0
      ? `${arrow} ${INR(Math.abs(gain))}${gainPct ? ` (${gainPct}%)` : ''}`
      : '–';

    const cells = cols.map(c => {
      const raw = row[c.key];
      const val = formatCell(raw, c.fmt);
      let style = '';
      if (c.align) style += `text-align:${c.align};`;
      if (c.fw) style += `font-weight:${c.fw};`;
      if (c.mono) style += 'font-family:monospace;font-size:12px;';
      // Allow HTML (e.g. qty_diff spans) — use innerHTML via template literal
      const inner = c.bold ? `<b>${val}</b>` : val;
      // For zerodha: tag live-updatable cells with data attributes
      const liveAttr = (tableName === 'zerodha_stocks' && ['ltp', 'current_value', '_alloc_pct'].includes(c.key))
        ? ` data-live-${c.key}="${a.instrument}"`
        : '';
      return `<td${style ? ` style="${style}"` : ''}${liveAttr}>${inner}</td>`;
    }).join('');

    const gainAttr = tableName === 'zerodha_stocks' ? ` data-live-gain="${a.instrument}"` : '';
    html += `
      <tr data-id="${a.id}">
        ${cells}
        <td style="text-align:right"${gainAttr}><span class="gain-badge ${badgeCls}">${gainLabel}</span></td>
        <td style="white-space:nowrap">
          <button class="asset-edit-btn" data-id="${a.id}" data-table="${tableName}" title="Edit" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 5px;opacity:0.7;" data-row='${JSON.stringify(a).replace(/'/g, "&apos;")}'>✏️</button>
          <button class="asset-delete-btn" data-id="${a.id}" data-table="${tableName}" title="Delete">🗑</button>
        </td>
      </tr>`;
  });
  tbody.innerHTML = html;

  // Show correct Actual Invested section; hide the other
  const actualCard = document.getElementById('assets-actual-invested-card');
  const fdSec = document.getElementById('assets-monthly-summary');
  const zerodhaSec = document.getElementById('zerodha-monthly-summary');

  if (tableName === 'bank_fd_assets') {
    if (actualCard) actualCard.classList.remove('hidden');
    if (fdSec) fdSec.classList.remove('hidden');
    if (zerodhaSec) zerodhaSec.classList.add('hidden');
    loadFdActualInvested(_currentUserId);
  } else if (tableName === 'zerodha_stocks') {
    if (actualCard) actualCard.classList.remove('hidden');
    if (fdSec) fdSec.classList.add('hidden');
    if (zerodhaSec) zerodhaSec.classList.remove('hidden');
    loadZerodhaActualInvested(_currentUserId);
  } else {
    if (actualCard) actualCard.classList.add('hidden');
    if (fdSec) fdSec.classList.add('hidden');
    if (zerodhaSec) zerodhaSec.classList.add('hidden');
  }

  // Auto-fetch live prices for Zerodha Stocks
  if (tableName === 'zerodha_stocks' && assets.length) {
    fetchAndRefreshZerodhaPrices(assets);
  }

  tbody.querySelectorAll('.asset-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = JSON.parse(btn.dataset.row);
      openEditAssetModal(row, btn.dataset.table);
    });
  });

  tbody.querySelectorAll('.asset-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      await deleteAsset(btn.dataset.id, btn.dataset.table);
    });
  });
}



async function deleteAsset(id, tableName) {
  const { error } = await sb.from(tableName).delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Entry deleted', 'success');
  loadAssets(_currentUserId, _currentAssetFilter);
}

// ── Add / Edit Asset Modal ────────────────────────────────────
const getAddAssetModal = () => document.getElementById('add-asset-modal');
let _editingAssetId = null;
let _editingAssetTable = null;

function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function openEditAssetModal(row, tableName) {
  // Zerodha stocks have their own dedicated edit modal
  if (tableName === 'zerodha_stocks') {
    openZerodhaEditModal(row);
    return;
  }

  _editingAssetId = row.id;
  _editingAssetTable = tableName;

  // Show/hide FD extra fields
  const fdExtra = document.getElementById('fd-extra-fields');
  const isFD = tableName === 'bank_fd_assets';
  if (fdExtra) {
    if (isFD) fdExtra.classList.remove('hidden');
    else fdExtra.classList.add('hidden');
  }

  // Pre-fill common fields
  setField('af-category', row.category);
  setField('af-platform', row.platform);
  setField('af-account-number', row.account_number);
  setField('af-sb-account', row.sb_account_number);
  setField('af-invested', row.invested);
  setField('af-current', row.current_value);
  setField('af-notes', row.notes);

  // Pre-fill FD fields
  if (isFD) {
    setField('af-invested-date', row.invested_date);
    setField('af-interest-rate', row.interest_rate);
    setField('af-maturity-date', row.maturity_date);
    setField('af-maturity-amount', row.maturity_amount);
  }

  // Update title and save button
  const titleEl = document.querySelector('#add-asset-modal h2');
  if (titleEl) titleEl.textContent = `Edit ${_currentAssetFilter || 'Asset'}`;
  const saveBtn = document.getElementById('add-asset-save-btn');
  if (saveBtn) saveBtn.textContent = '💾 Save Changes';

  getAddAssetModal().classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('af-category').focus();
}

function openAddAssetModal() {
  _editingAssetId = null;   // fresh add
  _editingAssetTable = null;

  // Show/hide Bank FD extra fields
  const fdExtra = document.getElementById('fd-extra-fields');
  const isFD = _currentAssetFilter === 'Bank FD';
  if (fdExtra) {
    if (isFD) fdExtra.classList.remove('hidden');
    else fdExtra.classList.add('hidden');
  }

  // Clear all fields
  ['af-category', 'af-platform', 'af-account-number', 'af-sb-account',
    'af-invested', 'af-current', 'af-notes',
    'af-invested-date', 'af-interest-rate', 'af-maturity-date', 'af-maturity-amount']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Update modal title + save button
  const titleEl = document.querySelector('#add-asset-modal h2');
  if (titleEl) titleEl.textContent = `Add ${_currentAssetFilter || 'Asset'}`;
  const saveBtn = document.getElementById('add-asset-save-btn');
  if (saveBtn) saveBtn.textContent = '💾 Save Asset';

  getAddAssetModal().classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('af-category').focus();
}

function closeAddAssetModal() {
  getAddAssetModal().classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Asset modal event wiring (runs after fragments-loaded) ────
document.addEventListener('fragments-loaded', () => {
  document.getElementById('add-asset-btn').addEventListener('click', () => {
    if (!_currentAssetFilter) {
      showToast('Please select an asset category first (e.g. Cash)', 'info');
      return;
    }
    openAddAssetModal();
  });
  document.getElementById('add-asset-close-btn').addEventListener('click', closeAddAssetModal);
  document.getElementById('add-asset-cancel-btn').addEventListener('click', closeAddAssetModal);
  getAddAssetModal().addEventListener('click', e => { if (e.target === getAddAssetModal()) closeAddAssetModal(); });

  document.getElementById('add-asset-save-btn').addEventListener('click', async () => {
    const category = document.getElementById('af-category').value.trim();

    if (!category) { showToast('Category / Type is required', 'error'); return; }
    if (!_currentAssetTable) { showToast('No asset category selected', 'error'); return; }

    const saveBtn = document.getElementById('add-asset-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    // Common payload
    const payload = {
      user_id: _currentUserId,
      category: category,
      platform: document.getElementById('af-platform').value.trim() || null,
      account_number: document.getElementById('af-account-number').value.trim() || null,
      sb_account_number: document.getElementById('af-sb-account').value.trim() || null,
      invested: parseFloat(document.getElementById('af-invested').value) || 0,
      current_value: parseFloat(document.getElementById('af-current').value) || 0,
      notes: document.getElementById('af-notes').value.trim() || null,
    };

    // Bank FD extras
    if (_currentAssetFilter === 'Bank FD') {
      payload.invested_date = document.getElementById('af-invested-date').value || null;
      payload.interest_rate = parseFloat(document.getElementById('af-interest-rate').value) || null;
      payload.maturity_date = document.getElementById('af-maturity-date').value || null;
      payload.maturity_amount = parseFloat(document.getElementById('af-maturity-amount').value) || null;
    }

    const table = _editingAssetId ? _editingAssetTable : _currentAssetTable;

    let dbOp;
    if (_editingAssetId) {
      // UPDATE existing row
      delete payload.user_id;   // don't overwrite owner
      dbOp = sb.from(table).update(payload).eq('id', _editingAssetId);
    } else {
      // INSERT new row
      dbOp = sb.from(table).insert(payload);
    }

    const { error } = await dbOp;
    saveBtn.textContent = '💾 Save Asset'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingAssetId ? 'Changes saved! ✅' : 'Entry saved! 🎉', 'success');
      _editingAssetId = null; _editingAssetTable = null;
      closeAddAssetModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });
}); // end asset modal wiring
