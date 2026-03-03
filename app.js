// ─── Supabase Config ──────────────────────────────────────────
const SUPABASE_URL = 'https://kgcuogyrxcbdlozgnfav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnY3VvZ3lyeGNiZGxvemduZmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzY0MDMsImV4cCI6MjA4ODAxMjQwM30.kEI2A8o3rxRJAgncH9gzxeFhB6PYyvLQ8IwKOTuAQ3U';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── DOM refs ─────────────────────────────────────────────────
const authView = document.getElementById('auth-view');
const dashView = document.getElementById('dashboard-view');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const userAvatarEl = document.getElementById('user-avatar');
const userAvatarPH = document.getElementById('user-avatar-placeholder');
const dashDateEl = document.getElementById('dash-date');
const allocContainer = document.getElementById('allocations-container');
const toastEl = document.getElementById('toast');
const allocChartWrap = document.getElementById('alloc-chart-wrap');
const allocLegendEl = document.getElementById('alloc-legend');
const allocModal = document.getElementById('alloc-modal');
const modalRowsEl = document.getElementById('modal-rows');
const modalTotalBadge = document.getElementById('modal-total-badge');

// ─── State ────────────────────────────────────────────────────
let allocChartInstance = null;
let _dashboardUserId = null;   // auth guard
let _currentUserId = null;   // for edit modal
let _currentAllocations = [];     // cached for edit modal

// ─── Chart colour palette ─────────────────────────────────────
const CHART_COLORS = [
  '#0077cc', '#0a9080', '#15803d', '#6d28d9',
  '#0ea5e9', '#059669', '#4f46e5', '#b45309',
];

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = { info: '💬', success: '✅', error: '❌' };
  toastEl.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// ─── Google Login ─────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  loginBtn.textContent = 'Redirecting…';
  loginBtn.disabled = true;
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    showToast('Login failed: ' + error.message, 'error');
    loginBtn.textContent = 'Continue with Google';
    loginBtn.disabled = false;
  }
});

// ─── Logout ───────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
  showToast('Signed out successfully', 'success');
});

// ─── Auth state ───────────────────────────────────────────────
sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    if (_dashboardUserId !== session.user.id) {
      _dashboardUserId = session.user.id;
      showDashboard(session.user);
    }
  } else {
    _dashboardUserId = null;
    showLogin();
  }
});

// ─── Show Login ───────────────────────────────────────────────
function showLogin() {
  dashView.classList.add('hidden');
  authView.classList.remove('hidden');
  document.title = 'FinTrack — Know Your Wealth';
}

// ─── Show Dashboard ───────────────────────────────────────────
function showDashboard(user) {
  authView.classList.add('hidden');
  dashView.classList.remove('hidden');
  document.title = 'FinTrack — Dashboard';

  _currentUserId = user.id;

  const fullName = user.user_metadata?.full_name || user.email || 'there';
  const firstName = fullName.split(' ')[0];
  userNameEl.textContent = firstName;

  const avatarUrl = user.user_metadata?.avatar_url;
  if (avatarUrl) {
    userAvatarEl.src = avatarUrl;
    userAvatarEl.classList.remove('hidden');
    userAvatarPH.classList.add('hidden');
  } else {
    userAvatarPH.textContent = firstName[0].toUpperCase();
    userAvatarPH.classList.remove('hidden');
    userAvatarEl.classList.add('hidden');
  }

  if (dashDateEl) {
    dashDateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  loadAllocations(user);
  loadDashboardStats(user.id);
}

// ─── Load allocations from Supabase ───────────────────────────
async function loadAllocations(user) {
  allocContainer.innerHTML = '<div class="spinner"></div>';
  allocChartWrap.style.display = 'none';
  allocLegendEl.innerHTML = '';

  const { data, error } = await sb
    .from('ideal_allocations')
    .select('*')
    .eq('user_id', user.id)
    .order('percentage', { ascending: false });

  if (error) {
    allocContainer.innerHTML = `
      <p style="font-size:13px;color:var(--muted);text-align:center;padding:16px;">
        No allocation data yet.<br/>
        <span style="color:var(--accent);cursor:pointer;" onclick="seedAllocations('${user.id}')">
          Set up defaults →
        </span>
      </p>`;
    return;
  }

  if (!data || data.length === 0) {
    await seedAllocations(user.id);
    return;
  }

  _currentAllocations = data;
  renderAllocations(data);
}

// ─── Render bar list + donut chart + legend ───────────────────
function renderAllocations(allocations) {
  _currentAllocations = allocations;

  // ── Allocation bar list ──────────────────────────────────
  allocContainer.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'alloc-list';

  allocations.forEach((a, i) => {
    const pct = (a.percentage * 100).toFixed(1);
    const color = CHART_COLORS[i % CHART_COLORS.length];
    list.innerHTML += `
      <div class="alloc-item">
        <div class="alloc-header">
          <span class="alloc-name">${a.item}</span>
          <span class="alloc-pct" style="color:${color}">${pct}%</span>
        </div>
        <div class="alloc-track">
          <div class="alloc-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},${color}99)"></div>
        </div>
      </div>`;
  });
  allocContainer.appendChild(list);

  // ── Donut chart ──────────────────────────────────────────
  allocChartWrap.style.display = 'flex';
  if (allocChartInstance) {
    allocChartInstance.destroy();
    allocChartInstance = null;
  }

  const canvas = document.getElementById('alloc-chart');
  allocChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: allocations.map(a => a.item),
      datasets: [{
        data: allocations.map(a => +(a.percentage * 100).toFixed(1)),
        backgroundColor: allocations.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 10,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` },
          bodyFont: { family: 'Inter', size: 13 },
          titleFont: { family: 'Inter', size: 12 },
          padding: 10,
          backgroundColor: '#1c1917',
          cornerRadius: 8,
        },
      },
      animation: { animateRotate: true, duration: 900 },
    },
  });

  // ── Legend ───────────────────────────────────────────────
  allocLegendEl.innerHTML = allocations.map((a, i) => `
    <div class="alloc-legend-item">
      <div class="alloc-legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      ${a.item}
    </div>`).join('');
}

// ─── Seed default allocations ─────────────────────────────────
async function seedAllocations(userId) {
  allocContainer.innerHTML = `
    <p style="font-size:13px;color:var(--muted);text-align:center;padding:16px;">
      Setting up defaults…
    </p>`;

  const defaults = [
    { user_id: userId, item: 'India Equity MF', type: 'Asset', category: 'Mutual Fund', percentage: 0.360 },
    { user_id: userId, item: 'India Equity Stocks', type: 'Asset', category: 'Equity', percentage: 0.275 },
    { user_id: userId, item: 'Foreign Equity/ETF', type: 'Asset', category: 'International', percentage: 0.100 },
    { user_id: userId, item: 'Gold', type: 'Asset', category: 'Gold', percentage: 0.100 },
    { user_id: userId, item: 'Bonds', type: 'Asset', category: 'Debt', percentage: 0.060 },
    { user_id: userId, item: 'Fixed Deposit', type: 'Asset', category: 'FD', percentage: 0.060 },
    { user_id: userId, item: 'Cash', type: 'Asset', category: 'Cash', percentage: 0.040 },
    { user_id: userId, item: 'Crypto', type: 'Asset', category: 'Crypto', percentage: 0.005 },
  ];

  const { error } = await sb.from('ideal_allocations').insert(defaults);

  if (error) {
    showToast('Could not seed allocations: ' + error.message, 'error');
    allocContainer.innerHTML = `<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px;">Could not load allocations.</p>`;
  } else {
    showToast('Default allocations set up!', 'success');
    loadAllocations({ id: userId });
  }
}

// ══════════════════════════════════════════════════════════════
//  EDIT MODAL
// ══════════════════════════════════════════════════════════════

// ── Open / close ─────────────────────────────────────────────
document.getElementById('edit-alloc-btn').addEventListener('click', () => {
  if (!_currentAllocations.length) {
    showToast('No allocations to edit yet', 'info');
    return;
  }
  openEditModal(_currentAllocations);
});

function openEditModal(allocations) {
  modalRowsEl.innerHTML = '';
  allocations.forEach(a => addModalRow(a.item, (a.percentage * 100).toFixed(1)));
  updateModalTotal();
  allocModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  allocModal.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

// Backdrop click
allocModal.addEventListener('click', e => { if (e.target === allocModal) closeModal(); });

// Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !allocModal.classList.contains('hidden')) closeModal(); });

// ── Add row ───────────────────────────────────────────────────
document.getElementById('modal-add-row-btn').addEventListener('click', () => {
  addModalRow('', '');
  const rows = modalRowsEl.querySelectorAll('.modal-row');
  rows[rows.length - 1]?.querySelector('.modal-input-name')?.focus();
});

function addModalRow(name, pct) {
  const row = document.createElement('div');
  row.className = 'modal-row';
  row.innerHTML = `
    <input class="modal-input modal-input-name" type="text"
      placeholder="e.g. India Equity MF" value="${name}" />
    <input class="modal-input modal-input-pct" type="number"
      placeholder="0.0" min="0" max="100" step="0.1" value="${pct}" />
    <button class="modal-remove-btn" title="Remove">✕</button>
  `;
  row.querySelector('.modal-remove-btn').addEventListener('click', () => {
    row.remove();
    updateModalTotal();
  });
  row.querySelectorAll('.modal-input').forEach(inp => inp.addEventListener('input', updateModalTotal));
  modalRowsEl.appendChild(row);
}

// ── Total badge ───────────────────────────────────────────────
function updateModalTotal() {
  let total = 0;
  modalRowsEl.querySelectorAll('.modal-input-pct').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  total = Math.round(total * 10) / 10;
  modalTotalBadge.className = 'modal-total-badge';

  if (Math.abs(total - 100) < 0.05) {
    modalTotalBadge.textContent = `✓ Total: ${total}%`;
    modalTotalBadge.classList.add('ok');
  } else if (total > 100) {
    modalTotalBadge.textContent = `Total: ${total}% (over by ${(total - 100).toFixed(1)}%)`;
    modalTotalBadge.classList.add('err');
  } else {
    modalTotalBadge.textContent = `Total: ${total}% (need ${(100 - total).toFixed(1)}% more)`;
    modalTotalBadge.classList.add('warn');
  }
}

// ── Save ─────────────────────────────────────────────────────
document.getElementById('modal-save-btn').addEventListener('click', saveAllocations);

async function saveAllocations() {
  const rows = [...modalRowsEl.querySelectorAll('.modal-row')];
  const items = rows
    .map(row => ({
      name: row.querySelector('.modal-input-name').value.trim(),
      pct: parseFloat(row.querySelector('.modal-input-pct').value) || 0,
    }))
    .filter(r => r.name && r.pct > 0);

  if (!items.length) {
    showToast('Add at least one valid row', 'error');
    return;
  }

  const total = items.reduce((s, r) => s + r.pct, 0);
  if (Math.abs(total - 100) > 0.5) {
    showToast(`Total must equal 100% (currently ${total.toFixed(1)}%)`, 'error');
    return;
  }

  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;

  // Delete existing → insert fresh
  const { error: delErr } = await sb
    .from('ideal_allocations')
    .delete()
    .eq('user_id', _currentUserId);

  if (delErr) {
    showToast('Save failed: ' + delErr.message, 'error');
    saveBtn.textContent = '💾 Save';
    saveBtn.disabled = false;
    return;
  }

  const newRows = items.map(r => ({
    user_id: _currentUserId,
    item: r.name,
    type: 'Asset',
    category: 'Custom',
    percentage: +(r.pct / 100).toFixed(4),
  }));

  const { error: insErr } = await sb.from('ideal_allocations').insert(newRows);

  saveBtn.textContent = '💾 Save';
  saveBtn.disabled = false;

  if (insErr) {
    showToast('Save failed: ' + insErr.message, 'error');
  } else {
    showToast('Allocation saved! 🎉', 'success');
    closeModal();
    loadAllocations({ id: _currentUserId });
  }
}

// ─── Page navigation ──────────────────────────────────────────
const allPages = ['page-dashboard', 'page-allocation', 'page-assets'];

function navigateTo(pageId, assetFilter = null) {
  // Hide all known pages
  allPages.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Show target page
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('anim-fadein');
  }

  // Load data when navigating to specific pages
  if (pageId === 'page-allocation' && _currentUserId && !_currentAllocations.length) {
    loadAllocations({ id: _currentUserId });
  }
  if (pageId === 'page-assets' && _currentUserId) {
    loadAssets(_currentUserId, assetFilter);
  }
  if (pageId === 'page-dashboard' && _currentUserId) {
    loadDashboardStats(_currentUserId);
  }
}

// ══════════════════════════════════════════════════════════════
//  ASSETS MODULE  (one Supabase table per asset class)
// ══════════════════════════════════════════════════════════════

const INR = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Map asset-class name → Supabase table name
const ASSET_TABLES = {
  'Cash': 'cash_assets',
  'Bank FD': 'bank_fd_assets',
};

// Per-table column definitions
// fmt: 'inr' | 'pct' | 'date' | 'mono' | null
const ASSET_COLUMNS = {
  cash_assets: [
    { key: 'category', label: 'Category', bold: true },
    { key: 'platform', label: 'Platform' },
    { key: 'account_number', label: 'Account No.', mono: true },
    { key: 'sb_account_number', label: 'SB Account No.', mono: true },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Amount', align: 'right', fmt: 'inr', fw: '600' },
  ],
  bank_fd_assets: [
    { key: 'category', label: 'Category', bold: true },
    { key: 'platform', label: 'Platform' },
    { key: 'account_number', label: 'Account No.', mono: true },
    { key: 'sb_account_number', label: 'SB Account No.', mono: true },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'invested_date', label: 'Invested Date', align: 'right', fmt: 'date' },
    { key: 'current_value', label: 'Amount', align: 'right', fmt: 'inr', fw: '600' },
    { key: 'interest_rate', label: 'Interest', align: 'right', fmt: 'pct' },
    { key: 'maturity_date', label: 'Maturity Date', align: 'right', fmt: 'date' },
    { key: 'maturity_amount', label: 'Maturity Amt', align: 'right', fmt: 'inr' },
  ],
};

function formatCell(val, fmt) {
  if (val === null || val === undefined || val === '') return '—';
  switch (fmt) {
    case 'inr': return INR(val);
    case 'pct': return `${(+val).toFixed(2)}%`;
    case 'date': {
      const d = new Date(val);
      return isNaN(d) ? val : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    default: return val;
  }
}

let _currentAssetTable = null;
let _currentAssetFilter = null;

// ── Dashboard stats (aggregates all asset tables) ──────────────────
async function loadDashboardStats(userId) {
  let totalInvested = 0, totalValue = 0, count = 0;

  // Query every known table in parallel
  const results = await Promise.all(
    Object.values(ASSET_TABLES).map(table =>
      sb.from(table).select('invested, current_value').eq('user_id', userId)
    )
  );

  results.forEach(({ data }) => {
    if (!data) return;
    data.forEach(row => {
      totalInvested += +row.invested || 0;
      totalValue += +row.current_value || 0;
      count += 1;
    });
  });

  const netWorthEl = document.getElementById('dash-net-worth');
  const netWorthSubEl = document.getElementById('dash-net-worth-sub');
  const totalAssetsEl = document.getElementById('dash-total-assets');
  const totalAssetsSubEl = document.getElementById('dash-total-assets-sub');

  if (netWorthEl) netWorthEl.textContent = INR(totalValue);
  if (netWorthSubEl) netWorthSubEl.textContent = count ? `${count} asset${count > 1 ? 's' : ''} tracked` : 'Add assets to calculate';
  if (totalAssetsEl) totalAssetsEl.textContent = INR(totalValue);
  if (totalAssetsSubEl) totalAssetsSubEl.textContent = `${count} asset${count > 1 ? 's' : ''} tracked`;
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

    // Aggregate totals from all known asset tables
    let totalInvested = 0, totalValue = 0, count = 0;
    const results = await Promise.all(
      Object.values(ASSET_TABLES).map(t =>
        sb.from(t).select('invested, current_value').eq('user_id', userId)
      )
    );
    results.forEach(({ data }) => {
      if (!data) return;
      data.forEach(row => {
        totalInvested += +row.invested || 0;
        totalValue += +row.current_value || 0;
        count++;
      });
    });
    const gain = totalValue - totalInvested;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('assets-total-invested', INR(totalInvested));
    set('assets-total-value', INR(totalValue));
    set('assets-count', count);
    const gainEl = document.getElementById('assets-total-gain');
    if (gainEl) {
      gainEl.textContent = (gain >= 0 ? '+' : '') + INR(gain);
      gainEl.style.color = gain > 0 ? 'var(--green)' : gain < 0 ? 'var(--danger)' : 'var(--muted)';
    }

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

  const { data, error } = await sb
    .from(tableName)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

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

  // Update thead dynamically
  if (thead) {
    thead.innerHTML =
      cols.map(c => `<th${c.align ? ` style="text-align:${c.align}"` : ''}>${c.label}</th>`).join('') +
      `<th style="text-align:right">Gain / Loss</th><th></th>`;
  }

  // Summary stats
  const totalInvested = assets.reduce((s, a) => s + (+a.invested || 0), 0);
  const totalValue = assets.reduce((s, a) => s + (+a.current_value || 0), 0);
  const totalGain = totalValue - totalInvested;

  document.getElementById('assets-total-invested').textContent = INR(totalInvested);
  document.getElementById('assets-total-value').textContent = INR(totalValue);
  document.getElementById('assets-count').textContent = assets.length;

  const gainEl = document.getElementById('assets-total-gain');
  gainEl.textContent = (totalGain >= 0 ? '+' : '') + INR(totalGain);
  gainEl.style.color = totalGain > 0 ? 'var(--green)' : totalGain < 0 ? 'var(--danger)' : 'var(--muted)';

  if (!assets.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}">
      <div class="assets-empty">
        <div class="empty-icon">🏦</div>
        No entries yet.<br/>Click <b>+ Add Asset</b> to get started.
      </div></td></tr>`;
    return;
  }

  let html = '';
  assets.forEach(a => {
    const invested = +a.invested || 0;
    const current = +a.current_value || 0;
    const gain = current - invested;
    const gainPct = invested > 0 ? ((gain / invested) * 100).toFixed(1) : null;

    let badgeCls = 'zero', arrow = '–';
    if (gain > 0) { badgeCls = 'pos'; arrow = '▲'; }
    if (gain < 0) { badgeCls = 'neg'; arrow = '▼'; }

    const gainLabel = gain !== 0
      ? `${arrow} ${INR(Math.abs(gain))}${gainPct ? ` (${gainPct}%)` : ''}`
      : '–';

    const cells = cols.map(c => {
      const raw = a[c.key];
      const val = formatCell(raw, c.fmt);
      let style = '';
      if (c.align) style += `text-align:${c.align};`;
      if (c.fw) style += `font-weight:${c.fw};`;
      if (c.mono) style += 'font-family:monospace;font-size:12px;';
      const inner = c.bold ? `<b>${val}</b>` : val;
      return `<td${style ? ` style="${style}"` : ''}>${inner}</td>`;
    }).join('');

    html += `
      <tr data-id="${a.id}">
        ${cells}
        <td style="text-align:right"><span class="gain-badge ${badgeCls}">${gainLabel}</span></td>
        <td style="white-space:nowrap">
          <button class="asset-edit-btn" data-id="${a.id}" data-table="${tableName}" title="Edit" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px 5px;opacity:0.7;" data-row='${JSON.stringify(a).replace(/'/g, "&apos;")}'>✏️</button>
          <button class="asset-delete-btn" data-id="${a.id}" data-table="${tableName}" title="Delete">🗑</button>
        </td>
      </tr>`;
  });
  tbody.innerHTML = html;

  // Show Actual Invested only for Bank FD
  if (tableName === 'bank_fd_assets') {
    loadFdActualInvested(_currentUserId);
  } else {
    const sec = document.getElementById('assets-monthly-summary');
    if (sec) sec.classList.add('hidden');
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


// ══════════════════════════════════════════════════════════════
//  FD ACTUAL INVESTED  — manual entries from fd_actual_invested
// ══════════════════════════════════════════════════════════════

let _editingFdInvestedId = null;

async function loadFdActualInvested(userId) {
  const section = document.getElementById('assets-monthly-summary');
  if (!section) return;
  section.classList.remove('hidden');

  const body = document.getElementById('assets-monthly-body');
  if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--muted2)">Loading…</td></tr>`;

  const { data, error } = await sb
    .from('fd_actual_invested')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--danger)">${error.message}</td></tr>`;
    return;
  }
  renderFdActualInvested(data || []);
}

function renderFdActualInvested(rows) {
  const body = document.getElementById('assets-monthly-body');
  const totalEl = document.getElementById('assets-monthly-total');
  if (!body) return;

  const grand = rows.reduce((s, r) => s + (+r.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${INR(grand)}`;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" style="padding:18px 14px;text-align:center;color:var(--muted2)">No entries yet — click <b>+ Add Entry</b></td></tr>`;
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const d = new Date(r.entry_date);
    const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--surface2)'}">
      <td style="padding:9px 14px;color:var(--accent);font-weight:500;border-bottom:1px solid var(--border)">${dateStr}</td>
      <td style="padding:9px 14px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">${INR(r.amount)}</td>
      <td style="padding:9px 14px;color:var(--muted2);font-size:12px;border-bottom:1px solid var(--border)">${r.notes || ''}</td>
      <td style="padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap">
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-fdi-id="${r.id}" data-fdi-date="${r.entry_date}" data-fdi-amount="${r.amount}" data-fdi-notes="${r.notes || ''}" class="fdi-edit-btn" title="Edit">✏️</button>
        <button style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.7" data-fdi-id="${r.id}" class="fdi-delete-btn" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('') +
    `<tr style="background:var(--surface2)">
    <td style="padding:9px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted2)">Total</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;color:var(--accent)">${INR(grand)}</td>
    <td colspan="2"></td>
  </tr>`;

  body.querySelectorAll('.fdi-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openFdInvestedModal({
      id: btn.dataset.fdiId, entry_date: btn.dataset.fdiDate,
      amount: btn.dataset.fdiAmount, notes: btn.dataset.fdiNotes
    }));
  });
  body.querySelectorAll('.fdi-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      await deleteFdInvested(btn.dataset.fdiId);
    });
  });
}

function openFdInvestedModal(row = null) {
  _editingFdInvestedId = row?.id || null;
  const titleEl = document.getElementById('fd-invested-modal-title');
  const saveBtn = document.getElementById('fd-invested-save-btn');
  if (titleEl) titleEl.textContent = row ? 'Edit Entry' : 'Add Entry';
  if (saveBtn) saveBtn.textContent = '💾 Save Entry';
  document.getElementById('fdi-date').value = row?.entry_date || '';
  document.getElementById('fdi-amount').value = row?.amount || '';
  document.getElementById('fdi-notes').value = row?.notes || '';
  document.getElementById('fd-invested-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeFdInvestedModal() {
  document.getElementById('fd-invested-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _editingFdInvestedId = null;
}

async function deleteFdInvested(id) {
  const { error } = await sb.from('fd_actual_invested').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Entry deleted', 'success');
  loadFdActualInvested(_currentUserId);
}

// Wire up fd-invested-modal events (safe to call at end of file, DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('fd-invested-modal');
  document.getElementById('fd-invested-add-btn')?.addEventListener('click', () => openFdInvestedModal());
  document.getElementById('fd-invested-close-btn')?.addEventListener('click', closeFdInvestedModal);
  document.getElementById('fd-invested-cancel-btn')?.addEventListener('click', closeFdInvestedModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeFdInvestedModal(); });

  document.getElementById('fd-invested-save-btn')?.addEventListener('click', async () => {
    const date = document.getElementById('fdi-date').value;
    const amount = parseFloat(document.getElementById('fdi-amount').value);
    const notes = document.getElementById('fdi-notes').value.trim() || null;

    if (!date) { showToast('Date is required', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    const saveBtn = document.getElementById('fd-invested-save-btn');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

    const payload = { entry_date: date, amount, notes };
    let op;
    if (_editingFdInvestedId) {
      op = sb.from('fd_actual_invested').update(payload).eq('id', _editingFdInvestedId);
    } else {
      payload.user_id = _currentUserId;
      op = sb.from('fd_actual_invested').insert(payload);
    }

    const { error } = await op;
    saveBtn.textContent = '💾 Save Entry'; saveBtn.disabled = false;

    if (error) {
      showToast('Save failed: ' + error.message, 'error');
    } else {
      showToast(_editingFdInvestedId ? 'Entry updated ✅' : 'Entry added 🎉', 'success');
      closeFdInvestedModal();
      loadFdActualInvested(_currentUserId);
    }
  });
});


async function deleteAsset(id, tableName) {
  const { error } = await sb.from(tableName).delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Entry deleted', 'success');
  loadAssets(_currentUserId, _currentAssetFilter);
}

// ── Add / Edit Asset Modal ────────────────────────────────────
const addAssetModal = document.getElementById('add-asset-modal');
let _editingAssetId = null;
let _editingAssetTable = null;

function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function openEditAssetModal(row, tableName) {
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

  addAssetModal.classList.remove('hidden');
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

  addAssetModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('af-category').focus();
}

function closeAddAssetModal() {
  addAssetModal.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('add-asset-btn').addEventListener('click', () => {
  if (!_currentAssetFilter) {
    showToast('Please select an asset category first (e.g. Cash)', 'info');
    return;
  }
  openAddAssetModal();
});
document.getElementById('add-asset-close-btn').addEventListener('click', closeAddAssetModal);
document.getElementById('add-asset-cancel-btn').addEventListener('click', closeAddAssetModal);
addAssetModal.addEventListener('click', e => { if (e.target === addAssetModal) closeAddAssetModal(); });

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

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
//  SIDEBAR NAVIGATION
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

// ── Expandable assets sub-group ──────────────────────────────
const assetsSubGroup = document.getElementById('assets-sub-group');
const assetsChevron = document.getElementById('assets-chevron');

function openAssetsSubGroup() {
  assetsSubGroup.classList.add('open');
  assetsChevron.classList.add('open');
}
function closeAssetsSubGroup() {
  assetsSubGroup.classList.remove('open');
  assetsChevron.classList.remove('open');
}
function toggleAssetsSubGroup() {
  assetsSubGroup.classList.contains('open') ? closeAssetsSubGroup() : openAssetsSubGroup();
}

// ── Set active sidebar item / sub-item ───────────────────────
function setActiveSidebarItem(el) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.sidebar-sub-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// ── Main sidebar items ────────────────────────────────────────
document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    const pageId = `page-${page}`;

    if (page === 'assets') {
      // Toggle sub-group open/close
      toggleAssetsSubGroup();
      setActiveSidebarItem(item);
      if (allPages.includes(pageId)) navigateTo(pageId, null);
    } else {
      closeAssetsSubGroup();
      setActiveSidebarItem(item);
      if (allPages.includes(pageId)) {
        navigateTo(pageId);
      } else {
        allPages.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      }
    }
  });
});

// ── Sub-items (e.g. Cash) ─────────────────────────────────────
document.querySelectorAll('.sidebar-sub-item[data-asset-filter]').forEach(sub => {
  sub.addEventListener('click', e => {
    e.stopPropagation();
    setActiveSidebarItem(sub);
    openAssetsSubGroup();
    navigateTo('page-assets', sub.dataset.assetFilter);
  });
});