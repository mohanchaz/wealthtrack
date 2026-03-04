// ══════════════════════════════════════════════════════════════
//  MUTUAL FUNDS — CSV import, edit, refresh, actual invested
// ══════════════════════════════════════════════════════════════

/**
 * Ordered list matching the exact CSV output from Zerodha Console.
 * Duplicate fund names (Quant Flexi Cap, Tata Large & Mid Cap) each have
 * TWO entries here — first occurrence in CSV maps to index 0, second to index 1.
 */
const MF_ORDERED_MAP = [
  { name: 'Aditya Birla Sun Life Large Cap Fund',          symbol: '0P0000XVWL.BO' },
  { name: 'Axis Small Cap Fund',                           symbol: '0P00011MAX.BO' },
  { name: 'Groww ELSS Tax Saver Fund',                     symbol: '0P0001BN7D.BO' },
  { name: 'HDFC ELSS Tax Saver Fund',                      symbol: '0P0000XW8Z.BO' },
  { name: 'HDFC Focused Fund',                             symbol: '0P0000XW75.BO' },
  { name: 'HDFC Nifty 100 Index Fund',                     symbol: '0P0001OF02.BO' },
  { name: 'ICICI Prudential Dividend Yield Equity Fund',   symbol: '0P000134CI.BO' },
  { name: 'ICICI Prudential Nifty Midcap 150 Index Fund',  symbol: '0P0001NYM0.BO' },
  { name: 'Kotak ELSS Tax Saver Fund',                     symbol: '0P0000XV6Q.BO' },
  { name: 'Motilal Oswal Midcap Fund',                     symbol: '0P00012ALS.BO' },
  { name: 'Nippon India ELSS Tax Saver Fund',              symbol: '0P00015E14.BO' },
  { name: 'Nippon India Growth Mid Cap Fund',              symbol: '0P0000XVDP.BO' },
  { name: 'Nippon India Large Cap Fund',                   symbol: '0P0000XVG6.BO' },
  { name: 'Nippon India Nifty Midcap 150 Index Fund',      symbol: '0P0001LMCS.BO' },
  { name: 'Nippon India Nifty Smallcap 250 Index Fund',    symbol: '0P0001KR2R.BO' },
  { name: 'Nippon India Power & Infra Fund',               symbol: '0P0000XVD7.BO' },
  { name: 'Nippon India Small Cap Fund',                   symbol: '0P0000XVFY.BO' },
  { name: 'Quant ELSS Tax Saver Fund',                     symbol: '0P0000XW51.BO' },
  { name: 'Quant Flexi Cap Fund',                          symbol: '0P0000XW4X.BO' }, // 1st folio
  { name: 'Quant Flexi Cap Fund',                          symbol: '0P0001BA3U.BO' }, // 2nd folio
  { name: 'SBI Contra Fund',                               symbol: '0P0000XVJR.BO' },
  { name: 'Sundaram ELSS Tax Saver Fund',                  symbol: '0P0001BLNN.BO' },
  { name: 'Sundaram Large Cap Fund',                       symbol: '0P0001KN71.BO' },
  { name: 'Tata ELSS Fund',                                symbol: '0P00014GLS.BO' },
  { name: 'Tata Large & Mid Cap Fund',                     symbol: '0P0001BBCV.BO' }, // 1st folio
  { name: 'Tata Large & Mid Cap Fund',                     symbol: '0P0000XVOJ.BO' }, // 2nd folio
  { name: 'Tata Nifty 50 Index Fund',                      symbol: '0P0000XVOZ.BO' },
];

/**
 * Given parsed CSV rows in order, assign each a unique fund_name and nav_symbol.
 * Duplicates become "Fund Name (2)" so each maps to a distinct DB row.
 */
function assignMfSymbols(parsedRows) {
  const occurrenceCount = {};

  return parsedRows.map(r => {
    const origName = r.fund_name;
    occurrenceCount[origName] = (occurrenceCount[origName] || 0) + 1;
    const occurrence = occurrenceCount[origName]; // 1-based

    // All map entries for this name (exact or partial)
    const candidates = MF_ORDERED_MAP.filter(m =>
      m.name.toLowerCase() === origName.toLowerCase() ||
      origName.toLowerCase().includes(m.name.toLowerCase()) ||
      m.name.toLowerCase().includes(origName.toLowerCase())
    );

    // Pick by occurrence index (0-based)
    const entry = candidates[occurrence - 1] || candidates[0] || null;

    // Total times this name appears in the full CSV
    const totalOccurrences = parsedRows.filter(x => x.fund_name === origName).length;
    const displayName = totalOccurrences > 1 ? `${origName} (${occurrence})` : origName;

    return {
      ...r,
      fund_name:  displayName,
      nav_symbol: entry ? entry.symbol : null,
    };
  });
}

// ── MF Actual Invested ────────────────────────────────────────

let _editingMfaiId = null;

async function loadMfActualInvested(userId) {
  const section = document.getElementById('mf-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('mf-monthly-body');
  if (body) body.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading\u2026</td></tr>';

  const { data, error } = await sb
    .from('mf_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">' + error.message + '</td></tr>';
    return;
  }
  renderMfActualInvested(data || []);
}

function renderMfActualInvested(rows) {
  const body    = document.getElementById('mf-monthly-body');
  const totalEl = document.getElementById('mf-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = 'Total: ' + INR(grand);

  const statTile = document.getElementById('assets-actual-invested');
  if (statTile) statTile.textContent = INR(grand);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="4" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet \u2014 click <b>+ Add Entry</b></td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d       = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<tr style="background:' + (i % 2 === 0 ? '#fff' : 'var(--surface2)') + '">'
      + '<td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">' + dateStr + '</td>'
      + '<td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">' + INR(r.amount) + '</td>'
      + '<td style="padding:9px 14px;color:var(--muted2);font-size:12px;border-bottom:1px solid var(--border)">' + (r.notes || '') + '</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">'
      + '<button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-mfai-id="' + r.id + '" data-mfai-date="' + r.entry_date + '" data-mfai-amount="' + r.amount + '" data-mfai-notes="' + (r.notes || '') + '" class="mfai-edit-btn" title="Edit">\u270f\ufe0f</button>'
      + '<button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-mfai-id="' + r.id + '" class="mfai-delete-btn" title="Delete">\uD83D\uDDD1</button>'
      + '</td></tr>';
  }).join('')
  + '<tr style="background:var(--surface2)">'
  + '<td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>'
  + '<td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">' + INR(grand) + '</td>'
  + '<td colspan="2"></td></tr>';

  body.querySelectorAll('.mfai-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openMfaiModal({
      id: btn.dataset.mfaiId, entry_date: btn.dataset.mfaiDate,
      amount: btn.dataset.mfaiAmount, notes: btn.dataset.mfaiNotes
    }));
  });
  body.querySelectorAll('.mfai-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      const { error } = await sb.from('mf_actual_invested').delete().eq('id', btn.dataset.mfaiId);
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
      showToast('Entry deleted', 'success');
      loadMfActualInvested(_currentUserId);
    });
  });
}

function openMfaiModal(row) {
  _editingMfaiId = row ? row.id : null;
  const titleEl = document.getElementById('mf-invested-modal-title');
  const saveBtn = document.getElementById('mf-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '\uD83D\uDCBE Save Entry';
  document.getElementById('mfai-date').value   = row ? (row.entry_date || '') : '';
  document.getElementById('mfai-amount').value = row ? (row.amount    || '') : '';
  document.getElementById('mfai-notes').value  = row ? (row.notes     || '') : '';
  document.getElementById('mf-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfaiModal() {
  document.getElementById('mf-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingMfaiId = null;
}

document.addEventListener('fragments-loaded', () => {
  const modal = document.getElementById('mf-invested-modal');
  document.getElementById('mf-invested-add-btn') && document.getElementById('mf-invested-add-btn').addEventListener('click', () => openMfaiModal(null));
  document.getElementById('mf-invested-close-btn') && document.getElementById('mf-invested-close-btn').addEventListener('click', closeMfaiModal);
  document.getElementById('mf-invested-cancel-btn') && document.getElementById('mf-invested-cancel-btn').addEventListener('click', closeMfaiModal);
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeMfaiModal(); });

  const saveInvestedBtn = document.getElementById('mf-invested-save-btn');
  if (saveInvestedBtn) saveInvestedBtn.addEventListener('click', async () => {
    const date   = document.getElementById('mfai-date').value;
    const amount = parseFloat(document.getElementById('mfai-amount').value);
    const notes  = document.getElementById('mfai-notes').value.trim() || null;

    if (!date)                  { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    saveInvestedBtn.textContent = 'Saving\u2026'; saveInvestedBtn.disabled = true;

    const payload = { entry_date: date, amount, notes };
    let op;
    if (_editingMfaiId) {
      op = sb.from('mf_actual_invested').update(payload).eq('id', _editingMfaiId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('mf_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveInvestedBtn.textContent = '\uD83D\uDCBE Save Entry'; saveInvestedBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingMfaiId ? 'Entry updated \u2705' : 'Entry added \uD83C\uDF89', 'success');
      closeMfaiModal();
      loadMfActualInvested(_currentUserId);
    }
  });
});

// ── MF Live NAV Refresh ───────────────────────────────────────

async function fetchAndRefreshMfPrices(assets) {
  const lastUpdateEl = document.getElementById('mf-last-updated');
  const refreshBtn   = document.getElementById('mf-refresh-btn');
  if (lastUpdateEl) lastUpdateEl.textContent = '\uD83D\uDD04 Fetching live NAVs\u2026';
  if (refreshBtn)   refreshBtn.disabled = true;

  // Collect unique symbols stored from import
  const symbolSet = new Set(assets.map(function(a) { return a.nav_symbol; }).filter(Boolean));

  if (!symbolSet.size) {
    if (lastUpdateEl) lastUpdateEl.textContent = '\u26A0\uFE0F No NAV symbols \u2014 re-import CSV';
    if (refreshBtn) refreshBtn.disabled = false;
    return;
  }

  var prices = null;
  try {
    const res = await fetch('/api/prices?symbols=' + encodeURIComponent(Array.from(symbolSet).join(',')));
    if (res.ok) {
      const raw = await res.json();
      if (!raw.error) prices = raw;
    }
  } catch (e) {
    console.warn('[MF NAV] fetch failed:', e.message);
  }

  if (refreshBtn) refreshBtn.disabled = false;

  if (!prices) {
    if (lastUpdateEl) lastUpdateEl.textContent = '\u26A0\uFE0F Could not fetch NAVs';
    showToast('NAV fetch failed', 'error');
    return;
  }

  // nav_symbol stored as "0P0000XW4X.BO"; price map key strips the suffix
  function getNav(sym) {
    return sym ? getLTP(prices, sym.replace(/\.(NS|BO)$/, '')) : null;
  }

  var totalValue = 0, totalInvested = 0;

  assets.forEach(function(a) {
    var nav = getNav(a.nav_symbol);
    totalValue    += (+a.qty || 0) * (nav || +a.avg_cost || 0);
    totalInvested += (+a.qty || 0) * (+a.avg_cost || 0);
  });

  assets.forEach(function(a) {
    var nav = getNav(a.nav_symbol);
    if (!nav) return;

    var qty         = +a.qty || 0;
    var curVal      = qty * nav;
    var investedAmt = qty * (+a.avg_cost || 0);
    var gain        = curVal - investedAmt;
    var gainPct     = investedAmt > 0 ? ((gain / investedAmt) * 100).toFixed(1) : null;
    var allocPct    = totalValue > 0 ? ((curVal / totalValue) * 100) : 0;

    var navCell = document.querySelector('[data-live-_live_nav="' + a.fund_name + '"]');
    if (navCell) navCell.textContent = INR(nav);

    var cvCell = document.querySelector('[data-live-current_value="' + a.fund_name + '"]');
    if (cvCell) cvCell.textContent = INR(curVal);

    var allocCell = document.querySelector('[data-live-_alloc_pct="' + a.fund_name + '"]');
    if (allocCell) {
      var barWidth = Math.min(allocPct, 100).toFixed(1);
      allocCell.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">'
        + '<span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">'
        + '<span style="display:block;height:100%;width:' + barWidth + '%;background:var(--accent);border-radius:99px"></span>'
        + '</span>'
        + '<b style="font-size:12px;color:var(--accent)">' + allocPct.toFixed(1) + '%</b>'
        + '</span>';
    }

    var gainTd = document.querySelector('[data-live-gain="' + a.fund_name + '"]');
    if (gainTd) {
      var arrow    = gain >= 0 ? '\u25b2' : '\u25bc';
      var badgeCls = gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'zero';
      gainTd.innerHTML = '<span class="gain-badge ' + badgeCls + '">' + arrow + ' ' + INR(Math.abs(gain)) + (gainPct ? ' (' + gainPct + '%)' : '') + '</span>';
    }
  });

  var totalGain    = totalValue - totalInvested;
  var totalGainPct = totalInvested > 0 ? ' (' + ((totalGain / totalInvested) * 100).toFixed(1) + '%)' : '';
  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('assets-total-value',    INR(totalValue));
  set('assets-total-invested', INR(totalInvested));
  var gainEl = document.getElementById('assets-total-gain');
  if (gainEl) {
    gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain) + totalGainPct;
    gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';
  }

  var now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastUpdateEl) lastUpdateEl.textContent = '\uD83D\uDFE2 Live \u00B7 ' + now;
}

// Wire Refresh button
document.addEventListener('fragments-loaded', function() {
  var rb = document.getElementById('mf-refresh-btn');
  if (rb) rb.addEventListener('click', function() {
    if (_currentAssetFilter === 'Mutual Funds') loadAssets(_currentUserId, 'Mutual Funds');
  });
});

// ── MF CSV Parse ──────────────────────────────────────────────

var _mfPreviewRows = [];

function parseMfCSV(text) {
  var lines  = text.trim().split(/\r?\n/);
  var header = lines[0].split(',').map(function(h) { return h.trim().replace(/^"|"$/g, ''); });

  function find() {
    var needles = Array.prototype.slice.call(arguments);
    for (var i = 0; i < needles.length; i++) {
      var needle = needles[i].toLowerCase();
      var idx = header.findIndex(function(h) { return h.toLowerCase().indexOf(needle) !== -1; });
      if (idx !== -1) return idx;
    }
    return -1;
  }

  var iName     = find('Instrument');
  var iQty      = find('Qty');
  var iAvgCost  = find('Avg. cost', 'Avg cost', 'avg_cost');
  var iInvested = find('Invested');
  var iCurVal   = find('Cur. val', 'Cur val', 'current_value');
  var iPnL      = find('P&L');
  var iNetChg   = find('Net chg');
  var iDayChg   = find('Day chg');

  var funds = [];
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    var cols  = lines[i].split(',');
    var clean = function(c) { return (c || '').toString().replace(/^"|"$/g, '').trim(); };
    var num   = function(c) { return parseFloat(clean(c)) || 0; };

    var name = clean(cols[iName]);
    if (!name) continue;

    // MF rows have mixed case; stock tickers are ALL CAPS
    if (!/[a-z]/.test(name)) continue;

    // Exclude gold funds
    if (/gold/i.test(name)) continue;

    funds.push({
      fund_name:     name,
      qty:           num(cols[iQty]),
      avg_cost:      num(cols[iAvgCost]),
      invested:      num(cols[iInvested]),
      current_value: num(cols[iCurVal]),
      pnl:           num(cols[iPnL]),
      net_chg:       num(cols[iNetChg]),
      day_chg:       num(cols[iDayChg]),
    });
  }

  return assignMfSymbols(funds);
}

// ── MF Import Modal ───────────────────────────────────────────

function openMfImportModal() {
  _mfPreviewRows = [];
  document.getElementById('mf-csv-input').value = '';
  document.getElementById('mf-csv-filename').textContent = '';
  document.getElementById('mf-preview-section').classList.add('hidden');
  document.getElementById('mf-import-confirm-btn').classList.add('hidden');
  document.getElementById('mf-import-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfImportModal() {
  document.getElementById('mf-import-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function handleMfCSV(file) {
  if (!file) return;
  document.getElementById('mf-csv-filename').textContent = file.name;

  var reader = new FileReader();
  reader.onload = function(e) {
    _mfPreviewRows = parseMfCSV(e.target.result);
    var count = _mfPreviewRows.length;

    document.getElementById('mf-fund-count').textContent   = count;
    document.getElementById('mf-import-count').textContent = count;

    var thead   = document.getElementById('mf-preview-thead');
    var tbody   = document.getElementById('mf-preview-body');
    var thStyle = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2);background:var(--surface2);border-bottom:1px solid var(--border)';

    thead.innerHTML = '<tr>'
      + '<th style="' + thStyle + ';text-align:center;width:32px">\u2713</th>'
      + '<th style="' + thStyle + ';text-align:left">Fund Name</th>'
      + '<th style="' + thStyle + '">Units</th>'
      + '<th style="' + thStyle + '">Avg NAV</th>'
      + '<th style="' + thStyle + '">Invested</th>'
      + '<th style="' + thStyle + '">Cur. Value</th>'
      + '<th style="' + thStyle + '">P&amp;L</th>'
      + '</tr>';

    var tdS = 'padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);font-size:12px';
    tbody.innerHTML = _mfPreviewRows.map(function(r, i) {
      var pnlColor = r.pnl >= 0 ? 'var(--green)' : 'var(--danger)';
      var symBadge = r.nav_symbol
        ? '<span style="font-size:10px;color:var(--muted2);margin-left:4px">' + r.nav_symbol + '</span>'
        : '<span style="font-size:10px;color:var(--danger);margin-left:4px">\u26a0\ufe0f no symbol</span>';
      return '<tr style="background:' + (i % 2 === 0 ? '#fff' : 'var(--surface2)') + '" data-idx="' + i + '">'
        + '<td style="' + tdS + ';text-align:center"><input type="checkbox" class="mf-row-chk" data-idx="' + i + '" checked style="cursor:pointer;width:15px;height:15px"></td>'
        + '<td style="' + tdS + ';text-align:left;font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.fund_name + symBadge + '</td>'
        + '<td style="' + tdS + '">' + r.qty + '</td>'
        + '<td style="' + tdS + '">' + INR(r.avg_cost) + '</td>'
        + '<td style="' + tdS + '">' + INR(r.invested) + '</td>'
        + '<td style="' + tdS + ';font-weight:600">' + INR(r.current_value) + '</td>'
        + '<td style="' + tdS + ';color:' + pnlColor + ';font-weight:600">' + INR(r.pnl) + '</td>'
        + '</tr>';
    }).join('');

    function updateCount() {
      var checked = tbody.querySelectorAll('.mf-row-chk:checked').length;
      document.getElementById('mf-import-count').textContent = checked;
      document.getElementById('mf-fund-count').textContent   = checked;
      var btn = document.getElementById('mf-import-confirm-btn');
      checked > 0 ? btn.classList.remove('hidden') : btn.classList.add('hidden');
    }
    tbody.querySelectorAll('.mf-row-chk').forEach(function(chk) { chk.addEventListener('change', updateCount); });

    document.getElementById('mf-preview-section').classList.remove('hidden');
    count > 0
      ? document.getElementById('mf-import-confirm-btn').classList.remove('hidden')
      : document.getElementById('mf-import-confirm-btn').classList.add('hidden');
  };
  reader.readAsText(file);
}

async function importMfFunds(allRows) {
  var checkedIdxs = new Set(
    Array.from(document.querySelectorAll('.mf-row-chk:checked')).map(function(c) { return +c.dataset.idx; })
  );
  var rows = allRows.filter(function(_, i) { return checkedIdxs.has(i); });
  if (!rows.length) { showToast('No funds selected', 'error'); return; }

  var confirmBtn = document.getElementById('mf-import-confirm-btn');
  confirmBtn.textContent = 'Importing\u2026';
  confirmBtn.disabled = true;

  var existingRes = await sb.from('mf_holdings').select('fund_name, qty').eq('user_id', _currentUserId);
  var existing = existingRes.data || [];

  var prevQtyMap = {};
  existing.forEach(function(r) { prevQtyMap[r.fund_name] = +r.qty || 0; });

  var incomingNames = new Set(rows.map(function(r) { return r.fund_name; }));
  var toDelete = existing.filter(function(r) { return !incomingNames.has(r.fund_name); }).map(function(r) { return r.fund_name; });
  if (toDelete.length) {
    await sb.from('mf_holdings').delete().eq('user_id', _currentUserId).in('fund_name', toDelete);
  }

  // Each row already has a unique fund_name (duplicates suffixed with (2)) — no dedup needed
  var payload = rows.map(function(r) {
    return {
      user_id:     _currentUserId,
      fund_name:   r.fund_name,
      qty:         r.qty,
      prev_qty:    prevQtyMap[r.fund_name] !== undefined ? prevQtyMap[r.fund_name] : 0,
      avg_cost:    r.avg_cost,
      nav_symbol:  r.nav_symbol || null,
      imported_at: new Date().toISOString(),
    };
  });

  // Delete ALL existing holdings for this user then insert fresh
  await sb.from('mf_holdings').delete().eq('user_id', _currentUserId);
  var res = await sb.from('mf_holdings').insert(payload);

  confirmBtn.textContent = '\uD83D\uDCE5 Import ' + rows.length + ' Funds';
  confirmBtn.disabled = false;

  if (res.error) {
    showToast('Import failed: ' + res.error.message, 'error');
  } else {
    showToast('\u2705 Imported ' + rows.length + ' funds successfully!', 'success');
    closeMfImportModal();
    loadAssets(_currentUserId, 'Mutual Funds');
  }
}

document.addEventListener('fragments-loaded', function() {
  var modal = document.getElementById('mf-import-modal');
  var importBtn = document.getElementById('mf-import-btn');
  if (importBtn) importBtn.addEventListener('click', openMfImportModal);
  var closeBtn = document.getElementById('mf-import-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeMfImportModal);
  var cancelBtn = document.getElementById('mf-import-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeMfImportModal);
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeMfImportModal(); });

  var csvInput = document.getElementById('mf-csv-input');
  if (csvInput) csvInput.addEventListener('change', function(e) { handleMfCSV(e.target.files[0]); });

  var confirmBtn = document.getElementById('mf-import-confirm-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', function() { if (_mfPreviewRows.length) importMfFunds(_mfPreviewRows); });
});

// ── MF Edit Modal ─────────────────────────────────────────────

var _editingMfId = null;
var _editingMfCurrentQty = null;

function openMfEditModal(row) {
  var isAdd = !row;
  _editingMfId         = row ? row.id   : null;
  _editingMfCurrentQty = row ? (+row.qty || 0) : 0;

  document.getElementById('mf-edit-modal-title').textContent = isAdd ? 'Add Fund' : 'Edit \u2014 ' + row.fund_name;
  var nameEl = document.getElementById('mfe-name');
  nameEl.value            = row ? (row.fund_name || '') : '';
  nameEl.readOnly         = !isAdd;
  nameEl.style.background = isAdd ? '' : 'var(--surface2)';
  nameEl.style.color      = isAdd ? '' : 'var(--muted)';
  nameEl.style.cursor     = isAdd ? '' : 'not-allowed';

  document.getElementById('mfe-qty').value      = row ? (row.qty      || '') : '';
  document.getElementById('mfe-avg-cost').value = row ? (row.avg_cost || '') : '';

  var saveBtn = document.getElementById('mf-edit-save-btn');
  if (saveBtn) saveBtn.textContent = isAdd ? '\uD83D\uDCBE Add Fund' : '\uD83D\uDCBE Save Changes';

  document.getElementById('mf-edit-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMfEditModal() {
  document.getElementById('mf-edit-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingMfId = null;
}

document.addEventListener('fragments-loaded', function() {
  var closeBtn  = document.getElementById('mf-edit-close-btn');
  var cancelBtn = document.getElementById('mf-edit-cancel-btn');
  var editModal = document.getElementById('mf-edit-modal');
  if (closeBtn)  closeBtn.addEventListener('click', closeMfEditModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeMfEditModal);
  if (editModal) editModal.addEventListener('click', function(e) { if (e.target === editModal) closeMfEditModal(); });

  var saveBtn = document.getElementById('mf-edit-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', async function() {
    var isAddMode = !_editingMfId;
    var fund_name = document.getElementById('mfe-name').value.trim();
    if (isAddMode && !fund_name) { showToast('Fund name is required', 'error'); return; }

    var qty     = parseFloat(document.getElementById('mfe-qty').value);
    var avgCost = parseFloat(document.getElementById('mfe-avg-cost').value);

    if (!qty || qty <= 0)         { showToast('Units must be greater than 0', 'error'); return; }
    if (!avgCost || avgCost <= 0) { showToast('Avg NAV must be greater than 0', 'error'); return; }

    saveBtn.textContent = 'Saving\u2026'; saveBtn.disabled = true;

    var error;
    if (isAddMode) {
      var res = await sb.from('mf_holdings').insert({ user_id: _currentUserId, fund_name: fund_name, qty: qty, prev_qty: 0, avg_cost: avgCost, nav_symbol: null });
      error = res.error;
    } else {
      var payload = { qty: qty, avg_cost: avgCost };
      if (qty !== _editingMfCurrentQty) payload.prev_qty = _editingMfCurrentQty;
      var res2 = await sb.from('mf_holdings').update(payload).eq('id', _editingMfId);
      error = res2.error;
    }

    saveBtn.textContent = isAddMode ? '\uD83D\uDCBE Add Fund' : '\uD83D\uDCBE Save Changes';
    saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(isAddMode ? 'Fund added \uD83C\uDF89' : 'Fund updated \u2705', 'success');
      closeMfEditModal();
      loadAssets(_currentUserId, _currentAssetFilter);
    }
  });
});