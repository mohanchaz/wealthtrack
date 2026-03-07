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

/**
 * Same as fetchLivePrices but passes symbols exactly as-is (no .NS appended).
 * Used for MF and Gold where symbols already include .BO / .NS suffix.
 */
async function fetchLivePricesRaw(symbols) {
  try {
    const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const priceMap = await res.json();
    if (priceMap.error) throw new Error(priceMap.error);
    console.log('[LivePricesRaw] received:', priceMap);
    return Object.keys(priceMap).length > 0 ? priceMap : null;
  } catch (err) {
    console.warn('[LivePricesRaw] fetch failed:', err.message);
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
  try {
    let totalInvested = 0, totalValue = 0, count = 0;

    // zerodha_stocks doesn't store invested/current_value — must compute from qty * avg_cost / ltp
    const fdLikeTables = ['bank_fd_assets', 'emergency_funds'];
    const nonStockTables = Object.entries(ASSET_TABLES)
      .filter(([, t]) => t !== 'zerodha_stocks' && t !== 'aionion_stocks' && t !== 'aionion_gold' && t !== 'mf_holdings' && t !== 'gold_holdings' && t !== 'bonds' && t !== 'amc_mf_holdings').map(([, t]) => t);

    const [assetResults, zerodhaResult, aionionResult, aionionGoldResult, mfResult, goldResult, bondsResult2, amcMfResult2, { data: fdData }, { data: efData }, { data: zaiData }, { data: aaiData }, { data: agaiData }, { data: mfaiData }, { data: gaiData }] = await Promise.all([
      Promise.all(nonStockTables.map(table =>
        sb.from(table).select(fdLikeTables.includes(table) ? 'invested' : 'invested, current_value').eq('user_id', userId)
      )),
      sb.from('zerodha_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
      sb.from('aionion_stocks').select('qty, avg_cost, instrument').eq('user_id', userId),
      sb.from('aionion_gold').select('qty, avg_cost, instrument').eq('user_id', userId),
      sb.from('mf_holdings').select('qty, avg_cost').eq('user_id', userId),
      sb.from('gold_holdings').select('qty, avg_cost').eq('user_id', userId),
      sb.from('bonds').select('invested, face_value').eq('user_id', userId),
      sb.from('amc_mf_holdings').select('qty, avg_cost').eq('user_id', userId),
      sb.from('fd_actual_invested').select('amount').eq('user_id', userId),
      sb.from('ef_actual_invested').select('amount').eq('user_id', userId),
      sb.from('zerodha_actual_invested').select('amount').eq('user_id', userId),
      sb.from('aionion_actual_invested').select('amount').eq('user_id', userId),
      sb.from('aionion_gold_actual_invested').select('amount').eq('user_id', userId),
      sb.from('mf_actual_invested').select('amount').eq('user_id', userId),
      sb.from('gold_actual_invested').select('amount').eq('user_id', userId)
    ]);

    assetResults.forEach(({ data }, i) => {
      if (!data) return;
      const isFdLike = fdLikeTables.includes(nonStockTables[i]);
      data.forEach(row => {
        const inv = +row.invested || 0;
        totalInvested += inv;
        totalValue += isFdLike ? inv : (+row.current_value || 0);
        count++;
      });
    });

    // Bonds: current value = face_value
    (bondsResult2.data || []).forEach(row => {
      totalInvested += +row.invested || 0;
      totalValue += +row.face_value || +row.invested || 0;
      count++;
    });

    // AMC MF: use avg_cost as placeholder
    (amcMfResult2.data || []).forEach(row => {
      const qty = +row.qty || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue += qty * (+row.avg_cost || 0);
      count++;
    });

    // Zerodha: fetch live prices; fall back to avg_cost if unavailable
    const zerodhaAssets = zerodhaResult.data || [];
    const zerodhaInstruments = zerodhaAssets.map(r => r.instrument);
    const zerodhaPrices = zerodhaInstruments.length ? (await fetchLivePrices(zerodhaInstruments)) || {} : {};
    zerodhaAssets.forEach(row => {
      const qty = +row.qty || 0;
      const ltp = getLTP(zerodhaPrices, row.instrument) || +row.avg_cost || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue += qty * ltp;
      count++;
    });

    // Aionion: fetch live prices; fall back to avg_cost if unavailable
    const aionionAssets = aionionResult.data || [];
    const aionionInstruments = aionionAssets.map(r => r.instrument);
    const aionionPrices = aionionInstruments.length ? (await fetchLivePrices(aionionInstruments)) || {} : {};
    aionionAssets.forEach(row => {
      const qty = +row.qty || 0;
      const ltp = getLTP(aionionPrices, row.instrument) || +row.avg_cost || 0;
      const invested = qty * (+row.avg_cost || 0);
      totalInvested += invested;
      totalValue += qty * ltp;
      count++;
    });

    // Aionion Gold: same as aionion stocks
    const aionionGoldAssets = aionionGoldResult.data || [];
    const aionionGoldInstruments = aionionGoldAssets.map(r => r.instrument);
    const aionionGoldPrices = aionionGoldInstruments.length ? (await fetchLivePrices(aionionGoldInstruments)) || {} : {};
    aionionGoldAssets.forEach(row => {
      const qty = +row.qty || 0;
      const ltp = getLTP(aionionGoldPrices, row.instrument) || +row.avg_cost || 0;
      totalInvested += qty * (+row.avg_cost || 0);
      totalValue += qty * ltp;
      count++;
    });

    // MF: use avg_cost as current value (no live NAV mapping yet on dashboard)
    (mfResult.data || []).forEach(row => {
      const qty = +row.qty || 0;
      const invested = qty * (+row.avg_cost || 0);
      totalInvested += invested;
      totalValue += invested;
      count++;
    });

    // Gold: use avg_cost as current value placeholder
    (goldResult.data || []).forEach(row => {
      const qty = +row.qty || 0;
      const invested = qty * (+row.avg_cost || 0);
      totalInvested += invested;
      totalValue += invested;
      count++;
    });

    const fdActual = (fdData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const efActual = (efData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const zaiActual = (zaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const aaiActual = (aaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const agaiActual = (agaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const mfaiActual = (mfaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const gaiActual = (gaiData || []).reduce((s, r) => s + (+r.amount || 0), 0);
    const actualInvested = fdActual + efActual + zaiActual + aaiActual + agaiActual + mfaiActual + gaiActual;
    const fdCount = (fdData || []).length;
    const zaiCount = (zaiData || []).length;
    const aaiCount = (aaiData || []).length;
    const agaiCount = (agaiData || []).length;
    const mfaiCount = (mfaiData || []).length;
    const gaiCount = (gaiData || []).length;
    const total = fdCount + zaiCount + aaiCount + agaiCount + mfaiCount + gaiCount;
    const entryLabel = `${fdCount} FD · ${zaiCount} Zerodha · ${aaiCount} Aionion · ${agaiCount} Aionion Gold · ${mfaiCount} MF · ${gaiCount} Gold entr${total !== 1 ? 'ies' : 'y'}`;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dash-net-worth', INR(totalValue));
    set('dash-net-worth-sub', count ? `${count} asset${count > 1 ? 's' : ''} tracked` : 'Add assets to calculate');
    set('dash-total-assets', INR(totalValue));
    set('dash-total-assets-sub', `${count} asset${count > 1 ? 's' : ''} tracked`);
    set('dash-actual-invested', INR(actualInvested));
    set('dash-actual-invested-sub', entryLabel);
  } catch (err) {
    console.error('[loadDashboardStats] crash:', err);
    const el = document.getElementById('page-dashboard');
    if (el) el.innerHTML = `<div style="padding:40px;color:#c00;font-family:sans-serif"><h3>Dashboard error</h3><pre style="white-space:pre-wrap">${err.stack || err.message}</pre></div>`;
  }
}

// ── Group Overview (Zerodha / Aionion / Foreign Investments) ──

async function loadGroupOverview(userId, group) {
  // Show/hide panels
  document.getElementById('assets-layout-row')?.classList.add('hidden');
  document.getElementById('group-overview-panel')?.classList.remove('hidden');
  document.getElementById('assets-actual-invested-card')?.classList.add('hidden');
  document.getElementById('assets-actual-gain-card')?.classList.add('hidden');
  document.getElementById('select-btn-row')?.classList.add('hidden');
  document.getElementById('bulk-delete-bar')?.classList.add('hidden');
  document.getElementById('generic-summary-row')?.classList.add('hidden');
  ['zerodha', 'aionion', 'aionion-gold', 'mf', 'gold', 'amc-mf', 'foreign'].forEach(p => {
    document.getElementById(`${p}-import-btn`)?.classList.add('hidden');
    document.getElementById(`${p}-refresh-btn`)?.classList.add('hidden');
    document.getElementById(`${p}-last-updated`)?.classList.add('hidden');
  });
  document.getElementById('add-asset-btn')?.classList.add('hidden');
  document.getElementById('assets-toolbar-label').textContent = `${group} Overview`;

  const subtitle = document.querySelector('#page-assets .page-subtitle');
  if (subtitle) subtitle.textContent = `${group} — all holdings at a glance`;

  const totalsEl = document.getElementById('group-overview-totals');
  const bodyEl = document.getElementById('group-overview-body');
  if (totalsEl) totalsEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted2)">Loading…</div>`;
  if (bodyEl) bodyEl.innerHTML = '';

  // Define sub-categories per group
  const subCats = group === 'Zerodha'
    ? [
      { label: 'Stocks', table: 'zerodha_stocks', type: 'stock', actualTable: 'zerodha_actual_invested', icon: '📊' },
      { label: 'Mutual Funds', table: 'mf_holdings', type: 'mf', actualTable: 'mf_actual_invested', icon: '💹' },
      { label: 'Gold', table: 'gold_holdings', type: 'gold', actualTable: null, icon: '🥇' },
    ]
    : group === 'Aionion'
    ? [
      { label: 'Stocks', table: 'aionion_stocks', type: 'stock', actualTable: 'aionion_actual_invested', icon: '📈' },
      { label: 'Gold', table: 'aionion_gold', type: 'astock', actualTable: null, icon: '🥇' },
    ]
    : [
      { label: 'Foreign Stocks', table: 'foreign_stock_holdings', type: 'foreign', actualTable: 'foreign_actual_invested', icon: '🌍' },
      { label: 'Crypto', table: 'crypto_holdings', type: 'crypto', actualTable: 'crypto_actual_invested', icon: '₿' },
    ];

  // Fetch all holdings + actual invested in parallel
  const holdingsQueries = subCats.map(sc => {
    if (sc.type === 'mf') return sb.from(sc.table).select('qty, avg_cost, nav_symbol').eq('user_id', userId);
    if (sc.type === 'gold') return sb.from(sc.table).select('qty, avg_cost, yahoo_symbol').eq('user_id', userId);
    if (sc.type === 'foreign') return sb.from(sc.table).select('qty, avg_price, currency').eq('user_id', userId);
    if (sc.type === 'crypto') return sb.from(sc.table).select('qty, avg_price_gbp').eq('user_id', userId);
    return sb.from(sc.table).select('qty, avg_cost, instrument').eq('user_id', userId);
  });
  const actualQueries = subCats.map(sc => {
    if (!sc.actualTable) return Promise.resolve({ data: [] });
    // foreign/crypto tables have gbp_amount+inr_rate; all others have amount
    const cols = (sc.type === 'foreign' || sc.type === 'crypto')
      ? 'gbp_amount, inr_rate'
      : 'amount';
    return sb.from(sc.actualTable).select(cols).eq('user_id', userId);
  });

  const [holdingsResults, actualResults] = await Promise.all([
    Promise.all(holdingsQueries),
    Promise.all(actualQueries),
  ]);

  // Fetch FX rates for Foreign Investments group (needed for INR conversion)
  let _ovGbpUsdRate = null, _ovUsdInrRate = null;
  if (group === 'Foreign Investments') {
    try {
      const fxRes = await fetch('/api/prices?symbols=GBPUSD%3DX%2CUSDINR%3DX');
      if (fxRes.ok) {
        const fxMap = await fxRes.json();
        const gbpEntry = fxMap['GBPUSD=X'] || fxMap['GBPUSDX'] || fxMap['GBPUSD'];
        const inrEntry = fxMap['USDINR=X'] || fxMap['USDINRX'] || fxMap['USDINR'];
        if (gbpEntry) _ovGbpUsdRate = typeof gbpEntry === 'object' ? gbpEntry.price : gbpEntry;
        if (inrEntry) _ovUsdInrRate = typeof inrEntry === 'object' ? inrEntry.price : inrEntry;
      }
    } catch (e) { /* FX fetch failed — will show — in tiles */ }
  }
  const _ovGbpInrRate = (_ovGbpUsdRate && _ovUsdInrRate) ? _ovGbpUsdRate * _ovUsdInrRate : null;

  // For stock tables, fetch live prices
  const rows = [];
  for (let i = 0; i < subCats.length; i++) {
    const sc = subCats[i];
    const holdings = holdingsResults[i].data || [];
    const actualData = actualResults[i].data || [];
    // foreign/crypto actual invested uses gbp_amount×inr_rate for INR; others use amount
    const actual = sc.type === 'foreign' || sc.type === 'crypto'
      ? actualData.reduce((s, r) => s + ((+r.gbp_amount || 0) * (+r.inr_rate || 0)), 0)
      : actualData.reduce((s, r) => s + (+r.amount || 0), 0);

    let invested = 0, curVal = 0;

    if (sc.type === 'stock' || sc.type === 'astock') {
      const instruments = holdings.map(r => r.instrument);
      const prices = instruments.length ? (await fetchLivePrices(instruments)) || {} : {};
      holdings.forEach(r => {
        const qty = +r.qty || 0;
        const ltp = getLTP(prices, r.instrument) || +r.avg_cost || 0;
        invested += qty * (+r.avg_cost || 0);
        curVal += qty * ltp;
      });
    } else if (sc.type === 'mf') {
      // Fetch live NAV — nav_symbol may or may not have .BO suffix; ensure it does before fetching
      const symbols = holdings.filter(r => r.nav_symbol).map(r => {
        const s = r.nav_symbol.trim();
        return /\.(NS|BO)$/i.test(s) ? s : s + '.BO';
      });
      const prices = symbols.length ? (await fetchLivePricesRaw(symbols)) || {} : {};
      holdings.forEach(r => {
        const qty = +r.qty || 0;
        const key = r.nav_symbol ? r.nav_symbol.trim().replace(/\.(NS|BO)$/i, '') : null;
        const liveNav = key ? getLTP(prices, key) : null;
        invested += qty * (+r.avg_cost || 0);
        curVal += qty * (liveNav || +r.avg_cost || 0);
      });
    } else if (sc.type === 'gold') {
      // Resolve symbol for each holding (same logic as resolveGoldSymbol in assets-gold.js)
      function _resolveGoldSym(r) {
        const raw = (r.yahoo_symbol || '').trim().toUpperCase()
                 || (r.holding_name || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!raw) return null;
        return /\.(NS|BO)$/i.test(raw) ? raw : raw + '.NS';
      }
      const nsSyms = new Set(), boSyms = new Set();
      holdings.forEach(r => {
        const sym = _resolveGoldSym(r);
        if (!sym) return;
        if (/\.BO$/i.test(sym)) boSyms.add(sym); else nsSyms.add(sym);
      });
      const [nsPrices, boPrices] = await Promise.all([
        nsSyms.size ? fetchLivePricesRaw([...nsSyms]).catch(() => null) : Promise.resolve(null),
        boSyms.size ? fetchLivePricesRaw([...boSyms]).catch(() => null) : Promise.resolve(null),
      ]);
      const prices = { ...(boPrices || {}), ...(nsPrices || {}) };
      holdings.forEach(r => {
        const qty = +r.qty || 0;
        const sym = _resolveGoldSym(r);
        const key = sym ? sym.replace(/\.(NS|BO)$/i, '') : null;
        const livePrice = key ? getLTP(prices, key) : null;
        invested += qty * (+r.avg_cost || 0);
        curVal += qty * (livePrice || +r.avg_cost || 0);
      });
    } else if (sc.type === 'foreign') {
      // Convert native price → INR: GBX (pence) → GBP (÷100) → INR; USD → INR
      holdings.forEach(r => {
        const qty = +r.qty || 0;
        const isGBX = r.currency === 'GBX';
        const nativeAmt = qty * (+r.avg_price || 0);
        let inrAmt = 0;
        if (isGBX && _ovGbpInrRate) {
          inrAmt = (nativeAmt / 100) * _ovGbpInrRate;  // GBX → GBP → INR
        } else if (!isGBX && _ovUsdInrRate) {
          inrAmt = nativeAmt * _ovUsdInrRate;           // USD → INR
        } else {
          // FX rates unavailable — use actual invested INR total as fallback
          inrAmt = 0;
        }
        invested += inrAmt;
        curVal += inrAmt;  // no live prices in overview; same as invested
      });
    } else if (sc.type === 'crypto') {
      // avg_price_gbp is in GBP → convert to INR
      holdings.forEach(r => {
        const qty = +r.qty || 0;
        const gbpAmt = qty * (+r.avg_price_gbp || 0);
        const inrAmt = _ovGbpInrRate ? gbpAmt * _ovGbpInrRate : 0;
        invested += inrAmt;
        curVal += inrAmt;
      });
    } else {
      holdings.forEach(r => {
        const qty = +r.qty || 0;
        invested += qty * (+r.avg_cost || 0);
        curVal += qty * (+r.avg_cost || 0);
      });
    }

    rows.push({ ...sc, invested, curVal, actual });
  }

  // Totals
  const totalInvested = rows.reduce((s, r) => s + r.invested, 0);
  const totalCurVal = rows.reduce((s, r) => s + r.curVal, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalGain = totalCurVal - totalInvested;
  const totalActualGain = totalCurVal - totalActual;

  // Update top stat cards
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('assets-total-invested', INR(totalInvested));
  set('assets-total-value', INR(totalCurVal));
  const cEl = document.getElementById('assets-count-inline'); if (cEl) cEl.textContent = rows.length + ' holding' + (rows.length !== 1 ? 's' : '');
  const gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    const pct = totalInvested > 0 ? ` (${((totalGain / totalInvested) * 100).toFixed(1)}%)` : '';
    gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + pct;
    gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  // Summary tile row
  const tileStyle = (color) => `background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px`;
  const gainColor = (v) => v > 0 ? 'var(--green)' : v < 0 ? 'var(--danger)' : 'var(--muted)';
  const fmtGain = (v, base) => {
    const pct = base > 0 ? ` (${((v / base) * 100).toFixed(1)}%)` : '';
    return `<b style="color:${gainColor(v)}">${v >= 0 ? '+' : ''}${INR(v)}${pct}</b>`;
  };

  totalsEl.innerHTML = [
    { label: 'Total Invested', val: `<b style="color:var(--accent)">${INR(totalInvested)}</b>` },
    { label: 'Current Value', val: `<b style="color:var(--teal)">${INR(totalCurVal)}</b>` },
    { label: 'Gain / Loss', val: fmtGain(totalGain, totalInvested) },
    { label: 'Actual Invested', val: totalActual > 0 ? `<b style="color:var(--green)">${INR(totalActual)}</b>` : `<span style="color:var(--muted2)">—</span>` },
    { label: 'Actual Gain / Loss', val: totalActual > 0 ? fmtGain(totalActualGain, totalActual) : `<span style="color:var(--muted2)">—</span>` },
  ].map(t => `<div style="${tileStyle()}">
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);margin-bottom:6px">${t.label}</div>
    <div style="font-size:18px">${t.val}</div>
  </div>`).join('');

  // Per-row breakdown
  const tdS = 'padding:12px 16px;border-bottom:1px solid var(--border)';
  bodyEl.innerHTML = rows.map((r, i) => {
    const gain = r.curVal - r.invested;
    const gainPct = r.invested > 0 ? ` (${((gain / r.invested) * 100).toFixed(1)}%)` : '';
    const actualGain = r.curVal - r.actual;
    const actualGainPct = r.actual > 0 ? ` (${((actualGain / r.actual) * 100).toFixed(1)}%)` : '';
    const rowBg = i % 2 === 0 ? '#fff' : 'var(--surface2)';
    const filter = group === 'Zerodha'
      ? (r.label === 'Stocks' ? 'Zerodha Stocks' : r.label === 'Mutual Funds' ? 'Mutual Funds' : 'Gold')
      : group === 'Aionion'
      ? (r.label === 'Stocks' ? 'Aionion Stocks' : 'Aionion Gold')
      : r.label; // Foreign Stocks, Crypto — label matches filter name directly

    return `<tr style="background:${rowBg};cursor:pointer" class="group-overview-row" data-filter="${filter}">
      <td style="${tdS}">
        <span style="font-size:15px;margin-right:8px">${r.icon}</span>
        <b>${r.label}</b>
      </td>
      <td style="${tdS};text-align:right">${INR(r.invested)}</td>
      <td style="${tdS};text-align:right;font-weight:600">${INR(r.curVal)}</td>
      <td style="${tdS};text-align:right;color:${gainColor(gain)};font-weight:600">
        ${gain >= 0 ? '+' : ''}${INR(gain)}<span style="font-size:11px;color:${gainColor(gain)}">${gainPct}</span>
      </td>
      <td style="${tdS};text-align:right">${r.actual > 0 ? INR(r.actual) : '<span style="color:var(--muted2)">—</span>'}</td>
      <td style="${tdS};text-align:right;font-weight:600;color:${r.actual > 0 ? gainColor(actualGain) : 'var(--muted2)'}">
        ${r.actual > 0 ? (actualGain >= 0 ? '+' : '') + INR(actualGain) + `<span style="font-size:11px">${actualGainPct}</span>` : '—'}
      </td>
    </tr>`;
  }).join('');

  // Click row → drill into sub-category
  bodyEl.querySelectorAll('.group-overview-row').forEach(row => {
    row.addEventListener('click', () => loadAssets(_currentUserId, row.dataset.filter));
  });
}

async function loadAssets(userId, filter = null) {
  const tbody = document.getElementById('assets-table-body');
  const addBtn = document.getElementById('add-asset-btn');
  const toolbarLabel = document.getElementById('assets-toolbar-label');

  // Group overview mode — intercept before normal table rendering
  if (filter === 'Zerodha' || filter === 'Aionion' || filter === 'Foreign Investments') {
    _currentAssetFilter = filter;
    _currentAssetTable = null;
    await loadGroupOverview(userId, filter);
    return;
  }

  tbody.innerHTML = `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">⏳</div>Loading…</div></td></tr>`;

  // Update subtitle
  const subtitle = document.querySelector('#page-assets .page-subtitle');

  if (!filter) {
    _currentAssetTable = null;
    _currentAssetFilter = null;
    if (subtitle) subtitle.textContent = 'All Assets — overview';
    if (toolbarLabel) toolbarLabel.textContent = 'All Assets';
    if (addBtn) addBtn.classList.add('hidden');

    // Show group overview panel, hide table layout
    document.getElementById('assets-layout-row')?.classList.add('hidden');
    document.getElementById('group-overview-panel')?.classList.remove('hidden');
    document.getElementById('generic-summary-row')?.classList.add('hidden');
    document.getElementById('assets-actual-invested-card')?.classList.add('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.add('hidden');
    ['assets-monthly-summary', 'zerodha-monthly-summary', 'aionion-monthly-summary', 'mf-monthly-summary',
      'foreign-inr-row', 'foreign-gbp-row'].forEach(id =>
        document.getElementById(id)?.classList.add('hidden')
      );
    ['zerodha', 'aionion', 'aionion-gold', 'mf', 'gold', 'amc-mf', 'foreign'].forEach(p => {
      document.getElementById(p + '-import-btn')?.classList.add('hidden');
      document.getElementById(p + '-refresh-btn')?.classList.add('hidden');
      document.getElementById(p + '-last-updated')?.classList.add('hidden');
    });

    const totalsEl = document.getElementById('group-overview-totals');
    const bodyEl = document.getElementById('group-overview-body');
    if (totalsEl) totalsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted2)">Loading\u2026</div>';
    if (bodyEl) bodyEl.innerHTML = '';

    try {

      // ── Helpers ────────────────────────────────────────────────
      async function fetchStockSub(table, actualTable) {
        const { data } = await sb.from(table).select('qty, avg_cost, instrument').eq('user_id', userId);
        const rows = data || [];
        const prices = rows.length ? (await fetchLivePrices(rows.map(r => r.instrument))) || {} : {};
        let inv = 0, cur = 0;
        rows.forEach(r => {
          const qty = +r.qty || 0;
          inv += qty * (+r.avg_cost || 0);
          cur += qty * (getLTP(prices, r.instrument) || +r.avg_cost || 0);
        });
        let actual = 0;
        if (actualTable) {
          const { data: ad } = await sb.from(actualTable).select('amount').eq('user_id', userId);
          actual = (ad || []).reduce((s, r) => s + (+r.amount || 0), 0);
        }
        return { inv, cur, actual };
      }

      async function fetchMfSub(actualTable) {
        const { data } = await sb.from('mf_holdings').select('qty, avg_cost, nav_symbol').eq('user_id', userId);
        const rows = data || [];
        const syms = rows.filter(r => r.nav_symbol).map(r => r.nav_symbol);
        const prices = syms.length ? (await fetchLivePricesRaw(syms)) || {} : {};
        let inv = 0, cur = 0;
        rows.forEach(r => {
          const qty = +r.qty || 0;
          const key = r.nav_symbol ? r.nav_symbol.replace(/\.(NS|BO)$/, '') : null;
          inv += qty * (+r.avg_cost || 0);
          cur += qty * (key ? getLTP(prices, key) : null || +r.avg_cost || 0);
        });
        let actual = 0;
        if (actualTable) {
          const { data: ad } = await sb.from(actualTable).select('amount').eq('user_id', userId);
          actual = (ad || []).reduce((s, r) => s + (+r.amount || 0), 0);
        }
        return { inv, cur, actual };
      }

      async function fetchGoldSub(table) {
        const { data } = await sb.from(table).select('qty, avg_cost, yahoo_symbol').eq('user_id', userId);
        const rows = data || [];
        const symSet = [...new Set(rows.filter(r => r.yahoo_symbol).map(r => r.yahoo_symbol))];
        let prices = {};
        if (symSet.length) {
          try {
            const res = await fetch('/api/prices?symbols=' + encodeURIComponent(symSet.join(',')));
            if (res.ok) { const raw = await res.json(); if (!raw.error) prices = raw; }
          } catch (e) { }
        }
        let inv = 0, cur = 0;
        rows.forEach(r => {
          const qty = +r.qty || 0;
          const key = r.yahoo_symbol ? r.yahoo_symbol.replace(/\.(NS|BO)$/, '') : null;
          inv += qty * (+r.avg_cost || 0);
          cur += qty * (key ? getLTP(prices, key) : null || +r.avg_cost || 0);
        });
        return { inv, cur, actual: 0 };
      }

      // ── Fetch all categories in parallel where possible ────────
      const [
        cashResult,
        fdResult, fdActual,
        efResult, efActual,
        bondsResult,
        zerodhaStocksRes, zerodhaActualRes,
        mfRes, mfActualRes,
        goldRes,
        aionionStocksRes, aionionActualRes,
        aionionGoldRes,
        amcMfRes, amcMfActualRes,
      ] = await Promise.all([
        sb.from('cash_assets').select('invested, current_value').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('bank_fd_assets').select('invested').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('fd_actual_invested').select('amount').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('emergency_funds').select('invested').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('ef_actual_invested').select('amount').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('bonds').select('invested, face_value').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('zerodha_stocks').select('qty, avg_cost, instrument').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('zerodha_actual_invested').select('amount').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('mf_holdings').select('qty, avg_cost, nav_symbol').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('mf_actual_invested').select('amount').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('gold_holdings').select('qty, avg_cost, yahoo_symbol').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('aionion_stocks').select('qty, avg_cost, instrument').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('aionion_actual_invested').select('amount').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('aionion_gold').select('qty, avg_cost, instrument').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('amc_mf_holdings').select('qty, avg_cost, nav_symbol').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
        sb.from('amc_mf_actual_invested').select('amount').eq('user_id', userId).then(r => r).catch(() => ({ data: [] })),
      ]);

      // Cash
      let cashInv = 0, cashCur = 0;
      (cashResult.data || []).forEach(r => { cashInv += +r.invested || 0; cashCur += +r.current_value || 0; });

      // Bank FD
      let fdInv = 0, fdCur = 0;
      (fdResult.data || []).forEach(r => { fdInv += +r.invested || 0; fdCur += +r.invested || 0; });
      const fdActualTotal = (fdActual.data || []).reduce((s, r) => s + (+r.amount || 0), 0);

      // Emergency Funds
      let efInv = 0, efCur = 0;
      (efResult.data || []).forEach(r => { efInv += +r.invested || 0; efCur += +r.invested || 0; });
      const efActualTotal = (efActual.data || []).reduce((s, r) => s + (+r.amount || 0), 0);

      // Bonds
      let bondsInv = 0, bondsCur = 0;
      (bondsResult.data || []).forEach(r => { bondsInv += +r.invested || 0; bondsCur += +r.face_value || +r.invested || 0; });

      // Zerodha stocks (needs live prices)
      const zerodhaRows = zerodhaStocksRes.data || [];
      const zPrices = zerodhaRows.length ? (await fetchLivePrices(zerodhaRows.map(r => r.instrument))) || {} : {};
      let zInv = 0, zCur = 0;
      zerodhaRows.forEach(r => {
        const qty = +r.qty || 0;
        zInv += qty * (+r.avg_cost || 0);
        zCur += qty * (getLTP(zPrices, r.instrument) || +r.avg_cost || 0);
      });

      // MF (needs live NAV — ensure .BO suffix before fetching)
      const mfRows = mfRes.data || [];
      const mfSyms = mfRows.filter(r => r.nav_symbol).map(r => {
        const s = r.nav_symbol.trim();
        return /\.(NS|BO)$/i.test(s) ? s : s + '.BO';
      });
      const mfPrices = mfSyms.length ? (await fetchLivePricesRaw(mfSyms)) || {} : {};
      let mfInv = 0, mfCur = 0;
      mfRows.forEach(r => {
        const qty = +r.qty || 0;
        const key = r.nav_symbol ? r.nav_symbol.trim().replace(/\.(NS|BO)$/i, '') : null;
        const nav = key ? getLTP(mfPrices, key) : null;
        mfInv += qty * (+r.avg_cost || 0);
        mfCur += qty * (nav || +r.avg_cost || 0);
      });

      // Gold (needs live price — resolve symbol same as assets-gold.js)
      const goldRows = goldRes.data || [];
      function _resolveGoldSymOv(r) {
        const raw = (r.yahoo_symbol || '').trim().toUpperCase()
                 || (r.holding_name || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!raw) return null;
        return /\.(NS|BO)$/i.test(raw) ? raw : raw + '.NS';
      }
      const goldNsSyms = new Set(), goldBoSyms = new Set();
      goldRows.forEach(r => {
        const sym = _resolveGoldSymOv(r);
        if (!sym) return;
        if (/\.BO$/i.test(sym)) goldBoSyms.add(sym); else goldNsSyms.add(sym);
      });
      const [goldNsPrices, goldBoPrices] = await Promise.all([
        goldNsSyms.size ? fetchLivePricesRaw([...goldNsSyms]).catch(() => null) : Promise.resolve(null),
        goldBoSyms.size ? fetchLivePricesRaw([...goldBoSyms]).catch(() => null) : Promise.resolve(null),
      ]);
      const goldPrices = { ...(goldBoPrices || {}), ...(goldNsPrices || {}) };
      let goldInv = 0, goldCur = 0;
      goldRows.forEach(r => {
        const qty = +r.qty || 0;
        const sym = _resolveGoldSymOv(r);
        const key = sym ? sym.replace(/\.(NS|BO)$/i, '') : null;
        const livePrice = key ? getLTP(goldPrices, key) : null;
        goldInv += qty * (+r.avg_cost || 0);
        goldCur += qty * (livePrice || +r.avg_cost || 0);
      });

      // Aionion stocks
      const aionionRows = aionionStocksRes.data || [];
      const aPrices = aionionRows.length ? (await fetchLivePrices(aionionRows.map(r => r.instrument))) || {} : {};
      let aInv = 0, aCur = 0;
      aionionRows.forEach(r => {
        const qty = +r.qty || 0;
        aInv += qty * (+r.avg_cost || 0);
        aCur += qty * (getLTP(aPrices, r.instrument) || +r.avg_cost || 0);
      });

      // Aionion gold
      const agRows = aionionGoldRes.data || [];
      const agPrices = agRows.length ? (await fetchLivePrices(agRows.map(r => r.instrument))) || {} : {};
      let agInv = 0, agCur = 0;
      agRows.forEach(r => {
        const qty = +r.qty || 0;
        agInv += qty * (+r.avg_cost || 0);
        agCur += qty * (getLTP(agPrices, r.instrument) || +r.avg_cost || 0);
      });

      const zerodhaActualTotal = (zerodhaActualRes.data || []).reduce((s, r) => s + (+r.amount || 0), 0);
      const mfActualTotal = (mfActualRes.data || []).reduce((s, r) => s + (+r.amount || 0), 0);
      const aionionActualTotal = (aionionActualRes.data || []).reduce((s, r) => s + (+r.amount || 0), 0);

      // AMC MF (needs live NAV)
      const amcMfRows = amcMfRes.data || [];
      const amcSyms = amcMfRows.filter(r => r.nav_symbol).map(r => r.nav_symbol);
      const amcPrices = amcSyms.length ? (await fetchLivePricesRaw(amcSyms)) || {} : {};
      let amcInv = 0, amcCur = 0;
      amcMfRows.forEach(r => {
        const qty = +r.qty || 0;
        const key = r.nav_symbol ? r.nav_symbol.replace(/\.(NS|BO)$/, '') : null;
        const nav = key ? getLTP(amcPrices, key) : null;
        amcInv += qty * (+r.avg_cost || 0);
        amcCur += qty * (nav || +r.avg_cost || 0);
      });
      const amcMfActualTotal = (amcMfActualRes.data || []).reduce((s, r) => s + (+r.amount || 0), 0);

      // ── Foreign Investments (Foreign Stocks + Crypto) ──────────
      // Fetch FX rates + foreign/crypto holdings in parallel
      const [
        foreignHoldingsRes, foreignActualRes,
        cryptoHoldingsRes, cryptoActualRes,
        fxRes,
      ] = await Promise.all([
        sb.from('foreign_stock_holdings').select('qty, avg_price, currency').eq('user_id', userId).catch(() => ({ data: [] })),
        sb.from('foreign_actual_invested').select('gbp_amount, inr_rate').eq('user_id', userId).catch(() => ({ data: [] })),
        sb.from('crypto_holdings').select('qty, avg_price_gbp').eq('user_id', userId).catch(() => ({ data: [] })),
        sb.from('crypto_actual_invested').select('gbp_amount, inr_rate').eq('user_id', userId).catch(() => ({ data: [] })),
        fetch('/api/prices?symbols=GBPUSD%3DX%2CUSDINR%3DX').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      ]);

      // Extract FX rates
      const fxMap = fxRes || {};
      const fxGbpUsd = fxMap['GBPUSD=X'] || fxMap['GBPUSDX'] || fxMap['GBPUSD'];
      const fxUsdInr = fxMap['USDINR=X'] || fxMap['USDINRX'] || fxMap['USDINR'];
      const ovGbpUsdRate = fxGbpUsd ? (typeof fxGbpUsd === 'object' ? fxGbpUsd.price : fxGbpUsd) : null;
      const ovUsdInrRate = fxUsdInr ? (typeof fxUsdInr === 'object' ? fxUsdInr.price : fxUsdInr) : null;
      const ovGbpInrRate = (ovGbpUsdRate && ovUsdInrRate) ? ovGbpUsdRate * ovUsdInrRate : null;

      // Foreign stocks → INR
      let foreignInv = 0;
      (foreignHoldingsRes.data || []).forEach(r => {
        const qty = +r.qty || 0;
        const isGBX = r.currency === 'GBX';
        const nativeAmt = qty * (+r.avg_price || 0);
        if (isGBX && ovGbpInrRate) foreignInv += (nativeAmt / 100) * ovGbpInrRate;
        else if (!isGBX && ovUsdInrRate) foreignInv += nativeAmt * ovUsdInrRate;
      });

      // Crypto → INR
      let cryptoInv = 0;
      (cryptoHoldingsRes.data || []).forEach(r => {
        const gbpAmt = (+r.qty || 0) * (+r.avg_price_gbp || 0);
        if (ovGbpInrRate) cryptoInv += gbpAmt * ovGbpInrRate;
      });

      const foreignInvTotal = foreignInv + cryptoInv;

      // Actual invested (gbp_amount × inr_rate for both tables)
      const foreignActualTotal = (foreignActualRes.data || []).reduce((s, r) => s + ((+r.gbp_amount || 0) * (+r.inr_rate || 0)), 0);
      const cryptoActualTotal  = (cryptoActualRes.data  || []).reduce((s, r) => s + ((+r.gbp_amount || 0) * (+r.inr_rate || 0)), 0);
      const foreignActualGrand = foreignActualTotal + cryptoActualTotal;

      // ── Build category rows ────────────────────────────────────
      const catRows = [
        { label: 'Cash', icon: '💵', filter: 'Cash', inv: cashInv, cur: cashCur, actual: cashInv },
        { label: 'Fixed Deposits', icon: '🏦', filter: 'Fixed Deposits', inv: fdInv, cur: fdCur, actual: fdActualTotal },
        { label: 'Emergency Funds', icon: '🛡️', filter: 'Emergency Funds', inv: efInv, cur: efCur, actual: efActualTotal },
        { label: 'Bonds', icon: '📜', filter: 'Bonds', inv: bondsInv, cur: bondsCur, actual: bondsInv },
        { label: 'Zerodha', icon: '📈', filter: 'Zerodha', inv: zInv + mfInv + goldInv, cur: zCur + mfCur + goldCur, actual: zerodhaActualTotal + mfActualTotal },
        { label: 'Aionion', icon: '📊', filter: 'Aionion', inv: aInv + agInv, cur: aCur + agCur, actual: aionionActualTotal },
        { label: 'AMC Mutual Funds', icon: '💼', filter: 'AMC Mutual Funds', inv: amcInv, cur: amcCur, actual: amcMfActualTotal },
        { label: 'Foreign Investments', icon: '🌍', filter: 'Foreign Investments', inv: foreignInvTotal, cur: foreignInvTotal, actual: foreignActualGrand },
      ].filter(r => r.inv > 0 || r.cur > 0);

      // ── Grand totals ───────────────────────────────────────────
      const grandInv = catRows.reduce((s, r) => s + r.inv, 0);
      const grandCur = catRows.reduce((s, r) => s + r.cur, 0);
      const grandActual = catRows.reduce((s, r) => s + r.actual, 0);
      const grandGain = grandCur - grandInv;
      const grandActualGain = grandCur - grandActual;

      // Update top stat tiles
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('assets-total-invested', INR(grandInv));
      setEl('assets-total-value', INR(grandCur));
      const cElA = document.getElementById('assets-count-inline');
      if (cElA) cElA.textContent = '';
      const gainElA = document.getElementById('assets-total-gain');
      if (gainElA) {
        const pct = grandInv > 0 ? ' (' + ((grandGain / grandInv) * 100).toFixed(1) + '%)' : '';
        gainElA.textContent = (grandGain >= 0 ? '+' : '') + INR(grandGain) + pct;
        gainElA.style.color = grandGain > 0 ? 'var(--green)' : grandGain < 0 ? 'var(--danger)' : 'var(--muted)';
      }

      // ── Render summary tiles ───────────────────────────────────
      const gainColor = v => v > 0 ? 'var(--green)' : v < 0 ? 'var(--danger)' : 'var(--muted)';
      const fmtGain = (v, base) => {
        const pct = base > 0 ? ' (' + ((v / base) * 100).toFixed(1) + '%)' : '';
        return '<b style="color:' + gainColor(v) + '">' + (v >= 0 ? '+' : '') + INR(v) + pct + '</b>';
      };
      totalsEl.innerHTML = [
        { label: 'Total Invested', val: '<b style="color:var(--accent)">' + INR(grandInv) + '</b>' },
        { label: 'Current Value', val: '<b style="color:var(--teal)">' + INR(grandCur) + '</b>' },
        { label: 'Gain / Loss', val: fmtGain(grandGain, grandInv) },
        { label: 'Actual Invested', val: grandActual > 0 ? '<b style="color:var(--green)">' + INR(grandActual) + '</b>' : '<span style="color:var(--muted2)">—</span>' },
        { label: 'Actual Gain / Loss', val: grandActual > 0 ? fmtGain(grandActualGain, grandActual) : '<span style="color:var(--muted2)">—</span>' },
      ].map(t =>
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px">' +
        '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);margin-bottom:6px">' + t.label + '</div>' +
        '<div style="font-size:18px">' + t.val + '</div>' +
        '</div>'
      ).join('');

      // ── Render breakdown table ─────────────────────────────────
      const tdS = 'padding:12px 16px;border-bottom:1px solid var(--border)';
      bodyEl.innerHTML = catRows.map((r, i) => {
        const gain = r.cur - r.inv;
        const gainPct = r.inv > 0 ? ' (' + ((gain / r.inv) * 100).toFixed(1) + '%)' : '';
        const actualGain = r.cur - r.actual;
        const actualGainPct = r.actual > 0 ? ' (' + ((actualGain / r.actual) * 100).toFixed(1) + '%)' : '';
        const rowBg = i % 2 === 0 ? '#fff' : 'var(--surface2)';
        return '<tr style="background:' + rowBg + ';cursor:pointer" class="group-overview-row" data-filter="' + r.filter + '">' +
          '<td style="' + tdS + '"><span style="font-size:15px;margin-right:8px">' + r.icon + '</span><b>' + r.label + '</b></td>' +
          '<td style="' + tdS + ';text-align:right">' + INR(r.inv) + '</td>' +
          '<td style="' + tdS + ';text-align:right;font-weight:600">' + INR(r.cur) + '</td>' +
          '<td style="' + tdS + ';text-align:right;color:' + gainColor(gain) + ';font-weight:600">' +
          (gain >= 0 ? '+' : '') + INR(gain) + '<span style="font-size:11px">' + gainPct + '</span>' +
          '</td>' +
          '<td style="' + tdS + ';text-align:right">' + (r.actual > 0 ? INR(r.actual) : '<span style="color:var(--muted2)">—</span>') + '</td>' +
          '<td style="' + tdS + ';text-align:right;font-weight:600;color:' + (r.actual > 0 ? gainColor(actualGain) : 'var(--muted2)') + '">' +
          (r.actual > 0 ? (actualGain >= 0 ? '+' : '') + INR(actualGain) + '<span style="font-size:11px">' + actualGainPct + '</span>' : '—') +
          '</td>' +
          '</tr>';
      }).join('');

      bodyEl.querySelectorAll('.group-overview-row').forEach(row => {
        row.addEventListener('click', () => loadAssets(_currentUserId, row.dataset.filter));
      });

    } catch (err) {
      console.error('Assets overview error:', err);
      if (totalsEl) totalsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--danger)">Failed to load overview: ' + err.message + '</div>';
    }

    return;
  }

  const tableName = ASSET_TABLES[filter];
  if (!tableName) {
    if (addBtn) addBtn.classList.add('hidden');
    tbody.innerHTML = `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">🚧</div>${filter} — coming soon!</div></td></tr>`;
    return;
  }

  // Reset ALL UI chrome before branching — prevents bleed-through when switching between pages
  document.getElementById('foreign-inr-row')?.classList.add('hidden');
  document.getElementById('foreign-gbp-row')?.classList.add('hidden');
  document.getElementById('crypto-inr-row')?.classList.add('hidden');
  document.getElementById('crypto-gbp-row')?.classList.add('hidden');
  document.getElementById('generic-summary-row')?.classList.add('hidden');
  document.getElementById('assets-actual-invested-card')?.classList.add('hidden');
  document.getElementById('assets-actual-gain-card')?.classList.add('hidden');
  ['assets-monthly-summary', 'zerodha-monthly-summary', 'aionion-monthly-summary',
   'aionion-gold-monthly-summary', 'ef-monthly-summary', 'mf-monthly-summary',
   'gold-monthly-summary', 'amc-mf-monthly-summary', 'foreign-monthly-summary',
   'crypto-monthly-summary'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  ['zerodha', 'aionion', 'aionion-gold', 'mf', 'gold', 'amc-mf', 'foreign'].forEach(p => {
    document.getElementById(p + '-import-btn')?.classList.add('hidden');
    document.getElementById(p + '-refresh-btn')?.classList.add('hidden');
    document.getElementById(p + '-last-updated')?.classList.add('hidden');
  });
  document.getElementById('crypto-import-btn')?.classList.add('hidden');
  document.getElementById('crypto-refresh-btn')?.classList.add('hidden');
  document.getElementById('crypto-last-updated')?.classList.add('hidden');

  _currentAssetTable = tableName;
  _currentAssetFilter = filter;
  if (subtitle) subtitle.textContent = `💵 ${filter}`;
  if (toolbarLabel) toolbarLabel.textContent = `Showing ${filter} assets`;
  if (addBtn) addBtn.classList.remove('hidden');

  // Crypto — handled by dedicated module
  if (tableName === 'crypto_holdings') {
    document.getElementById('assets-layout-row')?.classList.remove('hidden');
    document.getElementById('group-overview-panel')?.classList.add('hidden');
    document.getElementById('crypto-inr-row')?.classList.remove('hidden');
    document.getElementById('crypto-gbp-row')?.classList.remove('hidden');
    document.getElementById('select-btn-row')?.classList.remove('hidden');
    document.getElementById('bulk-delete-bar')?.classList.add('hidden');
    const _sb = document.getElementById('select-assets-btn');
    if (_sb) { _sb.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Select`; _sb.style.color='#0d9488'; _sb.style.background='rgba(20,184,166,0.1)'; _sb.style.borderColor='rgba(20,184,166,0.3)'; }
    document.getElementById('crypto-import-btn')?.classList.remove('hidden');
    document.getElementById('crypto-refresh-btn')?.classList.remove('hidden');
    document.getElementById('crypto-last-updated')?.classList.remove('hidden');
    if (addBtn) addBtn.classList.add('hidden');
    loadCryptoHoldings(userId);
    loadCryptoActualInvested(userId);
    return;
  }

  // Foreign Stocks — handled by dedicated module
  if (tableName === 'foreign_stock_holdings') {
    document.getElementById('assets-layout-row')?.classList.remove('hidden');
    document.getElementById('group-overview-panel')?.classList.add('hidden');
    document.getElementById('foreign-inr-row')?.classList.remove('hidden');
    document.getElementById('foreign-gbp-row')?.classList.remove('hidden');
    document.getElementById('select-btn-row')?.classList.remove('hidden');
    document.getElementById('bulk-delete-bar')?.classList.add('hidden');
    const _sb2 = document.getElementById('select-assets-btn');
    if (_sb2) { _sb2.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Select`; _sb2.style.color='#0d9488'; _sb2.style.background='rgba(20,184,166,0.1)'; _sb2.style.borderColor='rgba(20,184,166,0.3)'; }
    document.getElementById('foreign-import-btn')?.classList.remove('hidden');
    document.getElementById('foreign-refresh-btn')?.classList.remove('hidden');
    document.getElementById('foreign-last-updated')?.classList.remove('hidden');
    if (addBtn) addBtn.classList.add('hidden');
    document.querySelector('.assets-table')?.classList.add('foreign-compact');
    loadForeignStocks(userId);
    loadForeignActualInvested(userId);
    return;
  }

  document.querySelector('.assets-table')?.classList.remove('foreign-compact');

  // Show layout row when a category is selected; hide group overview
  const activeLayoutRow = document.getElementById('assets-layout-row');
  if (activeLayoutRow) activeLayoutRow.classList.remove('hidden');
  document.getElementById('group-overview-panel')?.classList.add('hidden');
  document.getElementById('generic-summary-row')?.classList.remove('hidden');

  // Pre-emptively hide all actual invested panels — renderAssetsTable will re-show the right one
  document.getElementById('assets-actual-invested-card')?.classList.add('hidden');
  document.getElementById('assets-actual-gain-card')?.classList.add('hidden');
  ['assets-monthly-summary', 'zerodha-monthly-summary', 'aionion-monthly-summary', 'ef-monthly-summary', 'mf-monthly-summary', 'amc-mf-monthly-summary', 'foreign-monthly-summary', 'crypto-monthly-summary'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });

  const isStockTable = tableName === 'zerodha_stocks' || tableName === 'aionion_stocks' || tableName === 'aionion_gold' || tableName === 'mf_holdings' || tableName === 'gold_holdings';
  const orderCol = tableName === 'bonds' ? 'name'
    : tableName === 'amc_mf_holdings' ? 'nav_symbol'
      : isStockTable ? (tableName === 'mf_holdings' ? 'fund_name' : tableName === 'gold_holdings' ? 'holding_name' : 'instrument')
        : 'created_at';
  const orderAsc = isStockTable || tableName === 'bonds';

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
            : tableName === 'bonds'
              ? 'id,user_id,name,platform,isin,bond_id,sb_account_number,invested,face_value,interest_rate,purchase_date,maturity_date,created_at'
              : tableName === 'amc_mf_holdings'
                ? 'id,user_id,platform,folio_number,qty,avg_cost,nav_symbol,created_at'
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
  ['zerodha', 'aionion', 'aionion-gold', 'mf', 'gold', 'foreign'].forEach(p => {
    document.getElementById(`${p}-import-btn`)?.classList.add('hidden');
    document.getElementById(`${p}-refresh-btn`)?.classList.add('hidden');
    document.getElementById(`${p}-last-updated`)?.classList.add('hidden');
  });
  document.getElementById('crypto-import-btn')?.classList.add('hidden');
  document.getElementById('crypto-refresh-btn')?.classList.add('hidden');
  document.getElementById('crypto-last-updated')?.classList.add('hidden');
  // Hide Foreign Stocks extra rows (only shown when tableName === 'foreign_stock_holdings')
  document.getElementById('foreign-inr-row')?.classList.add('hidden');
  document.getElementById('foreign-gbp-row')?.classList.add('hidden');
  document.getElementById('crypto-inr-row')?.classList.add('hidden');
  document.getElementById('crypto-gbp-row')?.classList.add('hidden');

  // Reset select mode on every new table load
  document.getElementById('bulk-delete-bar')?.classList.add('hidden');
  document.querySelectorAll('.asset-row-checkbox').forEach(c => c.checked = false);
  document.getElementById('select-btn-row')?.classList.remove('hidden');
  const selBtn = document.getElementById('select-assets-btn');
  if (selBtn) {
    selBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Select`;
    selBtn.style.color = '#0d9488';
    selBtn.style.background = 'rgba(20,184,166,0.1)';
    selBtn.style.borderColor = 'rgba(20,184,166,0.3)';
  }

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
  } else if (tableName === 'amc_mf_holdings') {
    document.getElementById('amc-mf-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.remove('hidden');
  } else if (tableName === 'foreign_stock_holdings') {
    document.getElementById('foreign-import-btn')?.classList.remove('hidden');
    document.getElementById('foreign-refresh-btn')?.classList.remove('hidden');
    document.getElementById('foreign-last-updated')?.classList.remove('hidden');
    if (addBtn2) addBtn2.classList.add('hidden');
  } else if (tableName === 'crypto_holdings') {
    document.getElementById('crypto-import-btn')?.classList.remove('hidden');
    document.getElementById('crypto-refresh-btn')?.classList.remove('hidden');
    document.getElementById('crypto-last-updated')?.classList.remove('hidden');
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
            : tableName === 'bonds'
              ? assets.reduce((s, a) => s + (+a.face_value || +a.invested || 0), 0)
              : tableName === 'amc_mf_holdings'
                ? assets.reduce((s, a) => s + ((+a.qty || 0) * (+a.avg_cost || 0)), 0)
                : (tableName === 'bank_fd_assets' || tableName === 'emergency_funds')
                  ? assets.reduce((s, a) => s + (+a.invested || 0), 0)
                  : assets.reduce((s, a) => s + (+a.current_value || 0), 0);
  const totalGain = totalValue - totalInvested;

  document.getElementById('assets-total-invested').textContent = INR(totalInvested);
  document.getElementById('assets-total-value').textContent = INR(totalValue);
  const cEl3 = document.getElementById('assets-count-inline'); if (cEl3) cEl3.textContent = assets.length + ' holding' + (assets.length !== 1 ? 's' : '');

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
        invested: (+a.qty || 0) * (+a.avg_cost || 0),
        current_value: (+a.qty || 0) * (+a.avg_cost || 0),  // placeholder; patched by fetchAndRefreshZerodhaPrices
        _alloc_pct: 0,  // placeholder; patched by fetchAndRefreshZerodhaPrices
      }
      : tableName === 'mf_holdings'
        ? {
          ...a,
          _ticker: a.nav_symbol ? a.nav_symbol.replace(/\.(NS|BO)$/, '') : null,
          _live_nav: null,  // patched live by fetchAndRefreshMfPrices
          _qty_diff: (+a.qty || 0) - (+a.prev_qty || 0),
          invested: (+a.qty || 0) * (+a.avg_cost || 0),
          current_value: (+a.qty || 0) * (+a.avg_cost || 0),
          _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
        }
        : tableName === 'aionion_stocks'
          ? {
            ...a,
            _name: null,  // patched live by fetchAndRefreshAionionPrices
            _ltp: null,   // patched live by fetchAndRefreshAionionPrices
            _qty_diff: (+a.qty || 0) - (+a.prev_qty || 0),
            invested: (+a.qty || 0) * (+a.avg_cost || 0),
            current_value: (+a.qty || 0) * (+a.avg_cost || 0),
            _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
          }
          : tableName === 'aionion_gold'
            ? {
              ...a,
              _ltp: null,
              invested: (+a.qty || 0) * (+a.avg_cost || 0),
              current_value: (+a.qty || 0) * (+a.avg_cost || 0),
              _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
            }
            : tableName === 'gold_holdings'
              ? {
                ...a,
                _ltp: null,  // patched live by fetchAndRefreshGoldPrices
                invested: (+a.qty || 0) * (+a.avg_cost || 0),
                current_value: (+a.qty || 0) * (+a.avg_cost || 0),
                _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
              }
              : (tableName === 'bank_fd_assets' || tableName === 'emergency_funds')
                ? { ...a, current_value: +a.invested || 0 }
                : tableName === 'bonds'
                  ? {
                    ...a,
                    current_value: +a.face_value || +a.invested || 0,
                  }
                  : tableName === 'amc_mf_holdings'
                    ? {
                      ...a,
                      _name: null,   // patched live by fetchAndRefreshAmcMfPrices
                      _live_nav: null,   // patched live
                      invested: (+a.qty || 0) * (+a.avg_cost || 0),
                      current_value: (+a.qty || 0) * (+a.avg_cost || 0),
                      _alloc_pct: totalValue > 0 ? (((+a.qty || 0) * (+a.avg_cost || 0)) / totalValue) * 100 : 0,
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
          : tableName === 'amc_mf_holdings' ? a.nav_symbol
            : a.instrument;
      const liveAttr = ((tableName === 'zerodha_stocks' && ['current_value', '_alloc_pct', '_name', '_ltp'].includes(c.key)) ||
        (tableName === 'aionion_stocks' && ['current_value', '_alloc_pct', '_name', '_ltp'].includes(c.key)) ||
        (tableName === 'aionion_gold' && ['current_value', '_alloc_pct', '_ltp'].includes(c.key)) ||
        (tableName === 'mf_holdings' && ['current_value', '_alloc_pct', '_live_nav'].includes(c.key)) ||
        (tableName === 'gold_holdings' && ['current_value', '_alloc_pct', '_ltp'].includes(c.key)) ||
        (tableName === 'amc_mf_holdings' && ['current_value', '_alloc_pct', '_live_nav', '_name'].includes(c.key)))
        ? ` data-live-${c.key}="${liveKey2}"`
        : '';
      return `<td${style ? ` style="${style}"` : ''}${liveAttr}>${inner}</td>`;
    }).join('');

    const liveKey = tableName === 'mf_holdings' ? a.fund_name : tableName === 'gold_holdings' ? a.holding_name : tableName === 'amc_mf_holdings' ? a.nav_symbol : a.instrument;
    const gainAttr = (tableName === 'zerodha_stocks' || tableName === 'aionion_stocks' || tableName === 'aionion_gold' || tableName === 'mf_holdings' || tableName === 'aionion_gold' || tableName === 'gold_holdings' || tableName === 'amc_mf_holdings') ? ` data-live-gain="${liveKey}"` : '';
    html += `
      <tr data-id="${a.id}">
        <td class="bulk-check-cell" style="width:32px;padding:0 8px;display:none">
          <input type="checkbox" class="asset-row-checkbox" data-id="${a.id}" data-table="${tableName}"
            style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)">
        </td>
        ${cells}
        <td style="text-align:right"${gainAttr}><span class="gain-badge ${badgeCls}">${gainLabel}</span></td>
        <td style="white-space:nowrap">
          <button class="asset-edit-btn" data-id="${a.id}" data-table="${tableName}" title="Edit" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 5px;opacity:0.7;" data-row='${JSON.stringify(a).replace(/'/g, "&apos;")}'>✏️</button>
        </td>
      </tr>`;
  });
  tbody.innerHTML = html;

  // Show correct Actual Invested section; hide the other
  const actualCard = document.getElementById('assets-actual-invested-card');
  const fdSec = document.getElementById('assets-monthly-summary');
  const zerodhaSec = document.getElementById('zerodha-monthly-summary');
  const aionionSec = document.getElementById('aionion-monthly-summary');
  const mfSec = document.getElementById('mf-monthly-summary');
  const amcMfSec = document.getElementById('amc-mf-monthly-summary');
  const efSec = document.getElementById('ef-monthly-summary');
  const allSecs = [fdSec, zerodhaSec, aionionSec, efSec, mfSec, amcMfSec];
  allSecs.forEach(s => s?.classList.add('hidden'));

  if (tableName === 'bank_fd_assets') {
    if (actualCard) actualCard.classList.remove('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.remove('hidden');
    if (fdSec) fdSec.classList.remove('hidden');
    loadFdActualInvested(_currentUserId);
  } else if (tableName === 'emergency_funds') {
    if (actualCard) actualCard.classList.remove('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.remove('hidden');
    if (efSec) efSec.classList.remove('hidden');
    loadEfActualInvested(_currentUserId);
  } else if (tableName === 'zerodha_stocks') {
    if (actualCard) actualCard.classList.remove('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.remove('hidden');
    if (zerodhaSec) zerodhaSec.classList.remove('hidden');
    loadZerodhaActualInvested(_currentUserId);
  } else if (tableName === 'aionion_stocks') {
    if (actualCard) actualCard.classList.remove('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.remove('hidden');
    if (aionionSec) aionionSec.classList.remove('hidden');
    loadAionionActualInvested(_currentUserId);
  } else if (tableName === 'aionion_gold') {
    if (actualCard) actualCard.classList.add('hidden');
  } else if (tableName === 'mf_holdings') {
    if (actualCard) actualCard.classList.remove('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.remove('hidden');
    if (mfSec) mfSec.classList.remove('hidden');
    loadMfActualInvested(_currentUserId);
  } else if (tableName === 'gold_holdings') {
    if (actualCard) actualCard.classList.add('hidden');
  } else if (tableName === 'amc_mf_holdings') {
    if (actualCard) actualCard.classList.remove('hidden');
    document.getElementById('assets-actual-gain-card')?.classList.remove('hidden');
    if (amcMfSec) amcMfSec.classList.remove('hidden');
    loadAmcMfActualInvested(_currentUserId);
  } else {
    if (actualCard) actualCard.classList.add('hidden');
  }

  // Auto-fetch live prices
  if (tableName === 'foreign_stock_holdings' && assets.length) fetchAndRefreshForeignPrices(assets);
  if (tableName === 'zerodha_stocks' && assets.length) fetchAndRefreshZerodhaPrices(assets);
  if (tableName === 'aionion_stocks' && assets.length) fetchAndRefreshAionionPrices(assets);
  if (tableName === 'aionion_gold' && assets.length) fetchAndRefreshAionionGoldPrices(assets);
  if (tableName === 'mf_holdings' && assets.length) fetchAndRefreshMfPrices(assets);
  if (tableName === 'gold_holdings' && assets.length) fetchAndRefreshGoldPrices(assets);
  if (tableName === 'amc_mf_holdings' && assets.length) fetchAndRefreshAmcMfPrices(assets);

  tbody.querySelectorAll('.asset-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = JSON.parse(btn.dataset.row.replace(/&apos;/g, "'"));
      openEditAssetModal(row, btn.dataset.table);
    });
  });

  // ── Checkbox change listener ──────────────────────────────
  tbody.querySelectorAll('.asset-row-checkbox').forEach(cb => {
    cb.addEventListener('change', () => { if (typeof updateBulkBar === 'function') updateBulkBar(); });
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
  if (tableName === 'bonds') {
    openBondModal(row);
    return;
  }
  if (tableName === 'amc_mf_holdings') {
    openAmcMfEditModal(row);
    return;
  }

  _editingAssetId = row.id;
  _editingAssetTable = tableName;

  // Show/hide FD extra fields
  const fdExtra = document.getElementById('fd-extra-fields');
  const isFD = tableName === 'bank_fd_assets' || tableName === 'emergency_funds';
  if (fdExtra) {
    if (isFD) fdExtra.classList.remove('hidden');
    else fdExtra.classList.add('hidden');
  }
  const curGroup = document.getElementById('af-current-group');
  if (curGroup) {
    if (isFD) curGroup.classList.add('hidden');
    else curGroup.classList.remove('hidden');
  }

  // Pre-fill common fields
  setField('af-category', row.category);
  setField('af-platform', row.platform);
  setField('af-account-number', row.account_number);
  setField('af-sb-account', row.sb_account_number);
  setField('af-invested', row.invested);
  if (!isFD) setField('af-current', row.current_value);
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
  const isFD = _currentAssetFilter === 'Fixed Deposits' || _currentAssetFilter === 'Emergency Funds';
  if (fdExtra) {
    if (isFD) fdExtra.classList.remove('hidden');
    else fdExtra.classList.add('hidden');
  }
  const curGroup2 = document.getElementById('af-current-group');
  if (curGroup2) {
    if (isFD) curGroup2.classList.add('hidden');
    else curGroup2.classList.remove('hidden');
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

  // ── Select / Bulk Delete ──────────────────────────────────
  let _selectMode = false;

  function enterSelectMode() {
    _selectMode = true;
    const btn = document.getElementById('select-assets-btn');
    if (btn) { btn.innerHTML = '✕ Cancel'; btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted2)'; }
    document.getElementById('bulk-delete-bar').classList.remove('hidden');
    document.querySelectorAll('.bulk-check-cell').forEach(c => c.style.display = '');
    updateBulkBar();
  }

  function exitSelectMode() {
    _selectMode = false;
    const btn = document.getElementById('select-assets-btn');
    if (btn) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L10 12L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Select`;
      btn.style.background = 'rgba(20,184,166,0.1)';
      btn.style.borderColor = 'rgba(20,184,166,0.3)';
      btn.style.color = '#0d9488';
    }
    document.getElementById('bulk-delete-bar')?.classList.add('hidden');
    document.getElementById('bulk-normal-state').style.display = 'flex';
    document.getElementById('bulk-confirm-state').style.display = 'none';
    document.querySelectorAll('.bulk-check-cell').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.asset-row-checkbox').forEach(c => c.checked = false);
    const sa = document.getElementById('main-select-all');
    if (sa) { sa.checked = false; sa.indeterminate = false; }
    updateBulkBar();
  }

  function updateBulkBar() {
    const all     = document.querySelectorAll('.asset-row-checkbox');
    const checked = document.querySelectorAll('.asset-row-checkbox:checked');
    const n = checked.length;
    const countEl = document.getElementById('bulk-delete-count');
    const confirmBtn = document.getElementById('bulk-delete-confirm-btn');
    if (countEl) countEl.textContent = n + ' selected';
    if (confirmBtn) confirmBtn.disabled = n === 0;
    const sa = document.getElementById('main-select-all');
    if (sa) {
      sa.indeterminate = n > 0 && n < all.length;
      sa.checked = all.length > 0 && n === all.length;
    }
  }
  window.updateBulkBar = updateBulkBar;

  document.getElementById('select-assets-btn')?.addEventListener('click', () => {
    if (_selectMode) exitSelectMode(); else enterSelectMode();
  });

  document.getElementById('main-select-all')?.addEventListener('change', function () {
    document.querySelectorAll('.asset-row-checkbox').forEach(cb => { cb.checked = this.checked; });
    updateBulkBar();
  });

  document.getElementById('bulk-cancel-btn')?.addEventListener('click', exitSelectMode);

  document.getElementById('bulk-delete-confirm-btn')?.addEventListener('click', () => {
    const n = document.querySelectorAll('.asset-row-checkbox:checked').length;
    if (!n) return;
    // Switch to confirm state
    document.getElementById('bulk-normal-state').style.display = 'none';
    document.getElementById('bulk-confirm-state').style.display = 'flex';
    document.getElementById('bulk-confirm-count').textContent = n === 1 ? '1 entry' : `${n} entries`;
  });

  document.getElementById('bulk-confirm-no-btn')?.addEventListener('click', () => {
    document.getElementById('bulk-normal-state').style.display = 'flex';
    document.getElementById('bulk-confirm-state').style.display = 'none';
  });

  document.getElementById('bulk-confirm-yes-btn')?.addEventListener('click', async () => {
    const checked = [...document.querySelectorAll('.asset-row-checkbox:checked')];
    if (!checked.length) return;
    const n = checked.length;
    const yesBtn = document.getElementById('bulk-confirm-yes-btn');
    yesBtn.textContent = 'Deleting…'; yesBtn.disabled = true;
    let anyError = false;
    for (const cb of checked) {
      const { error } = await sb.from(cb.dataset.table).delete().eq('id', cb.dataset.id);
      if (error) { showToast('Delete failed: ' + error.message, 'error'); anyError = true; }
    }
    yesBtn.textContent = 'Yes, delete'; yesBtn.disabled = false;
    document.getElementById('bulk-normal-state').style.display = 'flex';
    document.getElementById('bulk-confirm-state').style.display = 'none';
    if (!anyError) showToast(`${n} ${n === 1 ? 'entry' : 'entries'} deleted`, 'success');
    exitSelectMode();
    loadAssets(_currentUserId, _currentAssetFilter);
  });

  // Re-exit select mode whenever a new category is loaded
  const _origLoadAssets = loadAssets;
  // patch: exitSelectMode on each render (done inside renderAssetsTable via hidden cells)

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
    if (_currentAssetFilter === 'Bonds') {
      openBondModal(null);
      return;
    }
    if (_currentAssetFilter === 'AMC Mutual Funds') {
      openAmcMfEditModal(null);
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

    const isFDTable = _currentAssetTable === 'bank_fd_assets' || _currentAssetTable === 'emergency_funds';
    const payload = {
      user_id: _currentUserId,
      category: category,
      platform: document.getElementById('af-platform').value.trim() || null,
      account_number: document.getElementById('af-account-number').value.trim() || null,
      sb_account_number: document.getElementById('af-sb-account').value.trim() || null,
      invested: parseFloat(document.getElementById('af-invested').value) || 0,
      notes: document.getElementById('af-notes').value.trim() || null,
    };

    // current_value only for tables that have it (not FD/EF which use invested as value)
    if (!isFDTable) {
      payload.current_value = parseFloat(document.getElementById('af-current').value) || 0;
    }

    // Bank FD extras
    if (_currentAssetFilter === 'Fixed Deposits' || _currentAssetFilter === 'Emergency Funds') {
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

    let error;
    try {
      const result = await dbOp;
      error = result.error;
    } catch (e) {
      error = { message: e.message };
    }
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