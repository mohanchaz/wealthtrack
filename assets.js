/**
 * Fetch live NSE prices via /api/prices Cloudflare Function.
 * Shared by Zerodha and Aionion refresh paths.
 * Returns { INSTRUMENT: { price, name } } map, or null on failure.
 */
async function fetchLivePrices(instruments) {
  const symbols = instruments.map(i => i + '.NS').join(',');
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const priceMap = await res.json();
    if (priceMap.error) throw new Error(priceMap.error);
    console.log('[LivePrices] received:', priceMap);
    return Object.keys(priceMap).length > 0 ? priceMap : null;
  } catch (err) {
    console.warn('[LivePrices] fetch failed:', err.message);
    return null;
  }
}

// Helper — extract just the price from a priceMap entry (handles both old plain numbers and new {price,name} objects)
function getLTP(priceMap, instrument) {
  const entry = priceMap?.[instrument];
  if (!entry) return null;
  return typeof entry === 'object' ? entry.price : entry;
}

// Helper — extract company name from a priceMap entry
function getCompanyName(priceMap, instrument) {
  const entry = priceMap?.[instrument];
  if (!entry || typeof entry !== 'object') return null;
  return entry.name || null;
}

async function loadDashboardStats(userId) {
  let totalInvested = 0, totalValue = 0, count = 0;

  // zerodha_stocks doesn't store invested/current_value — must compute from qty * avg_cost / ltp
  const nonStockTables = Object.entries(ASSET_TABLES)
    .filter(([, t]) => t !== 'zerodha_stocks' && t !== 'aionion_stocks' && t !== 'aionion_gold' && t !== 'mf_holdings' && t !== 'gold_holdings').map(([, t]) => t);

  const [assetResults, zerodhaResult, aionionResult, aionionGoldResult, mfResult, goldResult, { data: fdData }, { data: zaiData }, { data: aaiData }, { data: agaiData }, { data: mfaiData }, { data: gaiData }] = await Promise.all([
    Promise.all(nonStockTables.map(table =>
      sb.from(table).select('invested, current_value').eq('user_id', userId)
    )),
    sb.from('zerodha_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
    sb.from('aionion_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
    sb.from('aionion_gold').select('qty, avg_cost, instrument').eq('user_id', userId),
    sb.from('mf_holdings').select('qty, avg_cost').eq('user_id', userId),
    sb.from('gold_holdings').select('qty, avg_cost').eq('user_id', userId),
    sb.from('fd_actual_invested').select('amount').eq('user_id', userId),
    sb.from('zerodha_actual_invested').select('amount').eq('user_id', userId),
    sb.from('aionion_actual_invested').select('amount').eq('user_id', userId),
    sb.from('aionion_gold_actual_invested').select('amount').eq('user_id', userId),
    sb.from('mf_actual_invested').select('amount').eq('user_id', userId),
    sb.from('gold_actual_invested').select('amount').eq('user_id', userId)
  ]);

  assetResults.forEach(({ data }) => {
    if (!data) return;
    data.forEach(row => {
      totalInvested += +row.invested || 0;
      totalValue += +row.current_value || 0;
      count++;
    });
  });

  // Zerodha: fetch live prices; fall back to avg_cost if unavailable
  const zerodhaAssets = zerodhaResult.data || [];
  const zerodhaInstruments = zerodhaAssets.map(r => r.instrument);
  const zerodhaPrices = zerodhaInstruments.length ? (await fetchLivePrices(zerodhaInstruments)) || {} : {};
  zerodhaAssets.forEach(row => {
    const qty = +row.qty || 0;
    const ltp = getLTP(zerodhaPrices, row.instrument) || +row.avg_cost || 0;
    totalInvested += qty * (+row.avg_cost || 0);
    totalValue    += qty * ltp;
    count++;
  });

  // Aionion: fetch live prices; fall back to avg_cost if unavailable
  const aionionAssets = aionionResult.data || [];
  const aionionInstruments = aionionAssets.map(r => r.instrument);
  const aionionPrices = aionionInstruments.length ? (await fetchLivePrices(aionionInstruments)) || {} : {};
  aionionAssets.forEach(row => {
    const qty      = +row.qty || 0;
    const ltp      = getLTP(aionionPrices, row.instrument) || +row.avg_cost || 0;
    const invested = qty * (+row.avg_cost || 0);
    totalInvested += invested;
    totalValue    += qty * ltp;
    count++;
  });

  // Aionion Gold: same as aionion stocks
  const aionionGoldAssets = aionionGoldResult.data || [];
  const aionionGoldInstruments = aionionGoldAssets.map(r => r.instrument);
  const aionionGoldPrices = aionionGoldInstruments.length ? (await fetchLivePrices(aionionGoldInstruments)) || {} : {};
  aionionGoldAssets.forEach(row => {
    const qty      = +row.qty || 0;
    const ltp      = getLTP(aionionGoldPrices, row.instrument) || +row.avg_cost || 0;
    totalInvested += qty * (+row.avg_cost || 0);
    totalValue    += qty * ltp;
    count++;
  });

  // MF: use avg_cost as current value (no live NAV mapping yet on dashboard)
  (mfResult.data || []).forEach(row => {
    const qty = +row.qty || 0;
    const invested = qty * (+row.avg_cost || 0);
    totalInvested += invested;
    totalValue    += invested;
    count++;
  });

  // Gold: use avg_cost as current value placeholder
  (goldResult.data || []).forEach(row => {
    const qty = +row.qty || 0;
    const invested = qty * (+row.avg_cost || 0);
    totalInvested += invested;
    totalValue    += invested;
    count++;
  });

  const fdActual   = (fdData   || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const zaiActual  = (zaiData  || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const aaiActual  = (aaiData  || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const agaiActual = (agaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const mfaiActual = (mfaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const gaiActual  = (gaiData  || []).reduce((s, r) => s + (+r.amount || 0), 0);
  const actualInvested = fdActual + zaiActual + aaiActual + agaiActual + mfaiActual + gaiActual;
  const fdCount   = (fdData   || []).length;
  const zaiCount  = (zaiData  || []).length;
  const aaiCount  = (aaiData  || []).length;
  const agaiCount = (agaiData || []).length;
  const mfaiCount = (mfaiData || []).length;
  const gaiCount  = (gaiData  || []).length;
  const total = fdCount + zaiCount + aaiCount + agaiCount + mfaiCount + gaiCount;
  const entryLabel = `${fdCount} FD · ${zaiCount} Zerodha · ${aaiCount} Aionion · ${agaiCount} Aionion Gold · ${mfaiCount} MF · ${gaiCount} Gold entr${total !== 1 ? 'ies' : 'y'}`;

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

    const nonStockTables2 = Object.entries(ASSET_TABLES)
      .filter(([, t]) => t !== 'zerodha_stocks' && t !== 'aionion_stocks' && t !== 'aionion_gold' && t !== 'mf_holdings' && t !== 'gold_holdings').map(([, t]) => t);

    const [otherResults, zerodhaResult, aionionResult, aionionGoldResult2, mfResult2, goldResult2] = await Promise.all([
      Promise.all(nonStockTables2.map(t =>
        sb.from(t).select('invested, current_value').eq('user_id', userId)
      )),
      sb.from('zerodha_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
      sb.from('aionion_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
      sb.from('aionion_gold').select('qty, avg_cost, instrument').eq('user_id', userId),
      sb.from('mf_holdings').select('qty, avg_cost').eq('user_id', userId),
      sb.from('gold_holdings').select('qty, avg_cost').eq('user_id', userId)
    ]);

    otherResults.forEach(({ data }) => {
      if (!data) return;
      data.forEach(row => {
        totalInvested += +row.invested || 0;
        totalValue += +row.current_value || 0;
        count++;
      });
    });

    // Zerodha: fetch live prices; fall back to avg_cost if unavailable
    const zerodhaAssets2 = zerodhaResult.data || [];
    const zerodhaInstruments2 = zerodhaAssets2.map(r => r.instrument);
    const zerodhaPrices2 = zerodhaInstruments2.length ? (await fetchLivePrices(zerodhaInstruments2)) || {} : {};
    zerodhaAssets2.forEach(row => {
      const qty = +row.qty || 0;
      const ltp = getLTP(zerodhaPrices2, row.instrument) || +row.avg_cost || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue    += qty * ltp;
      count++;
    });

    // Aionion: fetch live prices; fall back to avg_cost if unavailable
    const aionionAssets2 = aionionResult.data || [];
    const aionionInstruments2 = aionionAssets2.map(r => r.instrument);
    const aionionPrices2 = aionionInstruments2.length ? (await fetchLivePrices(aionionInstruments2)) || {} : {};
    aionionAssets2.forEach(row => {
      const qty      = +row.qty || 0;
      const ltp      = getLTP(aionionPrices2, row.instrument) || +row.avg_cost || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue    += qty * ltp;
      count++;
    });

    // Aionion Gold
    const agAssets2 = aionionGoldResult2.data || [];
    const agInstruments2 = agAssets2.map(r => r.instrument);
    const agPrices2 = agInstruments2.length ? (await fetchLivePrices(agInstruments2)) || {} : {};
    agAssets2.forEach(row => {
      const qty = +row.qty || 0;
      const ltp = getLTP(agPrices2, row.instrument) || +row.avg_cost || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue    += qty * ltp;
      count++;
    });

    // MF: use avg_cost as current value placeholder
    (mfResult2.data || []).forEach(row => {
      const qty = +row.qty || 0;
      const invested = qty * (+row.avg_cost || 0);
      totalInvested += invested;
      totalValue    += invested;
      count++;
    });

    // Gold: use avg_cost as current value placeholder
    (goldResult2.data || []).forEach(row => {
      const qty = +row.qty || 0;
      const invested = qty * (+row.avg_cost || 0);
      totalInvested += invested;
      totalValue    += invested;
      count++;
    });

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
    const [{ data: fdData2 }, { data: zaiData2 }, { data: aaiData2 }] = await Promise.all([
      sb.from('fd_actual_invested').select('amount').eq('user_id', userId),
      sb.from('zerodha_actual_invested').select('amount').eq('user_id', userId),
      sb.from('aionion_actual_invested').select('amount').eq('user_id', userId)
    ]);
    const actualInvested =
      (fdData2 || []).reduce((s, r) => s + (+r.amount || 0), 0) +
      (zaiData2 || []).reduce((s, r) => s + (+r.amount || 0), 0) +
      (aaiData2 || []).reduce((s, r) => s + (+r.amount || 0), 0);
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

  const isStockTable = tableName === 'zerodha_stocks' || tableName === 'aionion_stocks' || tableName === 'aionion_gold' || tableName === 'mf_holdings' || tableName === 'gold_holdings';
  const orderCol = isStockTable ? (tableName === 'mf_holdings' ? 'fund_name' : tableName === 'gold_holdings' ? 'holding_name' : 'instrument') : 'created_at';
  const orderAsc = isStockTable;

  const selectCols = tableName === 'aionion_stocks'
    ? 'id,user_id,instrument,qty,prev_qty,avg_cost,created_at,updated_at'
    : tableName === 'zerodha_stocks'
    ? 'id,user_id,instrument,qty,prev_qty,avg_cost,imported_at'
    : tableName === 'mf_holdings'
    ? 'id,user_id,fund_name,qty,prev_qty,avg_cost,nav_symbol,imported_at'
    : tableName === 'aionion_gold'
    ? 'id,user_id,instrument,qty,avg_cost'
    : tableName === 'gold_holdings'
    ? 'id,user_id,holding_name,holding_type,qty,avg_cost,yahoo_symbol,imported_at'
    : '*';
  const { data, error } = await sb
    .from(tableName)
    .select(selectCols)
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

  const isStockTable2 = tableName === 'zerodha_stocks' || tableName === 'aionion_stocks' || tableName === 'aionion_gold' || tableName === 'mf_holdings' || tableName === 'gold_holdings';

  // Hide all broker toolbar buttons first, then show only relevant ones
  ['zerodha', 'aionion', 'aionion-gold', 'mf', 'gold'].forEach(p => {
    document.getElementById(`${p}-import-btn`)?.classList.add('hidden');
    document.getElementById(`${p}-refresh-btn`)?.classList.add('hidden');
    document.getElementById(`${p}-last-updated`)?.classList.add('hidden');
  });
  const addBtn2 = document.getElementById('add-asset-btn');
  if (tableName === 'zerodha_stocks') {
    document.getElementById('zerodha-import-btn')?.classList.remove('hidden');
    document.getElementById('zerodha-refresh-btn')?.classList.remove('hidden');
    document.getElementById('zerodha-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.add('hidden');
  } else if (tableName === 'aionion_stocks') {
    document.getElementById('aionion-refresh-btn')?.classList.remove('hidden');
    document.getElementById('aionion-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.remove('hidden');
  } else if (tableName === 'aionion_gold') {
    document.getElementById('aionion-gold-refresh-btn')?.classList.remove('hidden');
    document.getElementById('aionion-gold-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.remove('hidden');
  } else if (tableName === 'mf_holdings') {
    document.getElementById('mf-import-btn')?.classList.remove('hidden');
    document.getElementById('mf-refresh-btn')?.classList.remove('hidden');
    document.getElementById('mf-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.add('hidden');
  } else if (tableName === 'gold_holdings') {
    document.getElementById('gold-import-btn')?.classList.remove('hidden');
    document.getElementById('gold-refresh-btn')?.classList.remove('hidden');
    document.getElementById('gold-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.add('hidden');
  }

  // Update thead dynamically
  if (thead) {
    thead.innerHTML =
      cols.map(c => `<th${c.align ? ` style="text-align:${c.align}"` : ''}>${c.label}</th>`).join('') +
      `<th style="text-align:right">Gain / Loss</th><th></th>`;
  }

  // Summary stats
  // For zerodha_stocks, invested/current_value are not stored — compute from qty * avg_cost / ltp
  const totalInvested = isStockTable2
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
    : assets.reduce((s, a) => s + (+a.invested || 0), 0);
  const totalValue = tableName === 'zerodha_stocks'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)  // placeholder until live prices load
    : tableName === 'aionion_stocks'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
    : tableName === 'aionion_gold'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
    : tableName === 'mf_holdings'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
    : tableName === 'gold_holdings'
    ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
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
        <div class="empty-icon">${tableName === 'zerodha_stocks' ? '📂' : tableName === 'mf_holdings' ? '📊' : '🏦'}</div>
        ${tableName === 'zerodha_stocks'
        ? 'No holdings yet — click <b>📥 Import CSV</b> to import your Zerodha portfolio'
        : tableName === 'mf_holdings'
        ? 'No funds yet — click <b>📥 Import CSV</b> to import from your Zerodha holdings'
        : tableName === 'gold_holdings'
        ? 'No gold yet — click <b>📥 Import CSV</b> to import from your Zerodha holdings'
        : 'No entries yet.<br/>Click <b>+ Add Asset</b> to get started.'}
      </div></td></tr>`;
    return;
  }

  let html = '';
  assets.forEach(a => {
    // Inject virtual fields for stock tables — computed from stored qty, avg_cost, ltp/avg_cost
    const row = tableName === 'zerodha_stocks'
      ? {
        ...a,
        _name: null,  // patched live by fetchAndRefreshZerodhaPrices
        _ltp: null,   // patched live by fetchAndRefreshZerodhaPrices
        _qty_diff: (+a.qty || 0) - (+a.prev_qty || 0),
        invested:      (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.avg_cost || 0),  // placeholder; patched by fetchAndRefreshZerodhaPrices
        _alloc_pct: 0,  // placeholder; patched by fetchAndRefreshZerodhaPrices
      }
      : tableName === 'mf_holdings'
      ? {
        ...a,
        _ticker:   a.nav_symbol ? a.nav_symbol.replace(/\.(NS|BO)$/, '') : null,
        _live_nav: null,  // patched live by fetchAndRefreshMfPrices
        _qty_diff: (+a.qty || 0) - (+a.prev_qty || 0),
        invested:      (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.avg_cost || 0),
        _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
      }
      : tableName === 'aionion_stocks'
      ? {
        ...a,
        _name: null,  // patched live by fetchAndRefreshAionionPrices
        _ltp: null,   // patched live by fetchAndRefreshAionionPrices
        _qty_diff: (+a.qty || 0) - (+a.prev_qty || 0),
        invested:      (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.avg_cost || 0),
        _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
      }
      : tableName === 'aionion_gold'
      ? {
        ...a,
        _ltp:          null,
        invested:      (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.avg_cost || 0),
        _alloc_pct:    totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
      }
      : tableName === 'gold_holdings'
      ? {
        ...a,
        _ltp:          null,  // patched live by fetchAndRefreshGoldPrices
        invested:      (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.avg_cost || 0),
        _alloc_pct:    totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
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
      // For MF fund_name: show ticker symbol below the name
      let inner;
      if (tableName === 'mf_holdings' && c.key === 'fund_name' && row._ticker) {
        inner = `<span style="display:flex;flex-direction:column;gap:1px"><b>${val}</b><span style="font-size:10.5px;color:var(--muted2);font-weight:400">${row._ticker}</span></span>`;
      } else {
        inner = c.bold ? `<b>${val}</b>` : val;
      }
      // For zerodha/aionion: tag live-updatable cells with data attributes
      const liveKey2 = tableName === 'mf_holdings' ? a.fund_name
        : tableName === 'gold_holdings' ? a.holding_name
        : a.instrument;
      const liveAttr = ((tableName === 'zerodha_stocks' && ['current_value', '_alloc_pct', '_name', '_ltp'].includes(c.key)) ||
                        (tableName === 'aionion_stocks' && ['current_value', '_alloc_pct', '_name', '_ltp'].includes(c.key)) ||
                        (tableName === 'aionion_gold'   && ['current_value', '_alloc_pct', '_ltp'].includes(c.key)) ||
                        (tableName === 'mf_holdings'    && ['current_value', '_alloc_pct', '_live_nav'].includes(c.key)) ||
                        (tableName === 'gold_holdings'  && ['current_value', '_alloc_pct', '_ltp'].includes(c.key)))
        ? ` data-live-${c.key}="${liveKey2}"`
        : '';
      return `<td${style ? ` style="${style}"` : ''}${liveAttr}>${inner}</td>`;
    }).join('');

    const liveKey  = tableName === 'mf_holdings' ? a.fund_name : tableName === 'gold_holdings' ? a.holding_name : a.instrument;
    const gainAttr = (tableName === 'zerodha_stocks' || tableName === 'aionion_stocks' || tableName === 'aionion_gold' || tableName === 'mf_holdings' || tableName === 'aionion_gold' || tableName === 'gold_holdings') ? ` data-live-gain="${liveKey}"` : '';
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
  const fdSec      = document.getElementById('assets-monthly-summary');
  const zerodhaSec = document.getElementById('zerodha-monthly-summary');
  const aionionSec = document.getElementById('aionion-monthly-summary');
  const mfSec      = document.getElementById('mf-monthly-summary');
  // Gold sections have no actual invested panel
  const allSecs = [fdSec, zerodhaSec, aionionSec, mfSec];
  allSecs.forEach(s => s?.classList.add('hidden'));

  if (tableName === 'bank_fd_assets') {
    if (actualCard) actualCard.classList.remove('hidden');
    if (fdSec)      fdSec.classList.remove('hidden');
    loadFdActualInvested(_currentUserId);
  } else if (tableName === 'zerodha_stocks') {
    if (actualCard) actualCard.classList.remove('hidden');
    if (zerodhaSec) zerodhaSec.classList.remove('hidden');
    loadZerodhaActualInvested(_currentUserId);
  } else if (tableName === 'aionion_stocks') {
    if (actualCard) actualCard.classList.remove('hidden');
    if (aionionSec) aionionSec.classList.remove('hidden');
    loadAionionActualInvested(_currentUserId);
  } else if (tableName === 'aionion_gold') {
    if (actualCard) actualCard.classList.add('hidden');
  } else if (tableName === 'mf_holdings') {
    if (actualCard) actualCard.classList.remove('hidden');
    if (mfSec)      mfSec.classList.remove('hidden');
    loadMfActualInvested(_currentUserId);
  } else if (tableName === 'gold_holdings') {
    if (actualCard) actualCard.classList.add('hidden');
  } else {
    if (actualCard) actualCard.classList.add('hidden');
  }

  // Auto-fetch live prices
  if (tableName === 'zerodha_stocks' && assets.length) fetchAndRefreshZerodhaPrices(assets);
  if (tableName === 'aionion_stocks' && assets.length) fetchAndRefreshAionionPrices(assets);
  if (tableName === 'aionion_gold'   && assets.length) fetchAndRefreshAionionGoldPrices(assets);
  if (tableName === 'mf_holdings'    && assets.length) fetchAndRefreshMfPrices(assets);
  if (tableName === 'gold_holdings'  && assets.length) fetchAndRefreshGoldPrices(assets);

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
  // Stock tables have their own dedicated edit modal
  if (tableName === 'zerodha_stocks') {
    openZerodhaEditModal(row);
    return;
  }
  if (tableName === 'aionion_stocks') {
    openAionionEditModal(row);
    return;
  }
  if (tableName === 'aionion_gold') {
    openAionionGoldEditModal(row);
    return;
  }
  if (tableName === 'mf_holdings') {
    openMfEditModal(row);
    return;
  }
  if (tableName === 'gold_holdings') {
    openGoldEditModal(row);
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
    if (_currentAssetFilter === 'Aionion Stocks') {
      openAionionEditModal(null);
      return;
    }
    if (_currentAssetFilter === 'Aionion Gold') {
      openAionionGoldEditModal(null);
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