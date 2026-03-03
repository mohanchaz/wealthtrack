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

function navigateTo(pageId) {
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
    loadAssets(_currentUserId);
  }
}

// ══════════════════════════════════════════════════════════════
//  ASSETS MODULE
// ══════════════════════════════════════════════════════════════

const INR = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadAssets(userId) {
  document.getElementById('assets-table-body').innerHTML =
    `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">⏳</div>Loading…</div></td></tr>`;

  const { data, error } = await sb
    .from('assets')
    .select('*')
    .eq('user_id', userId)
    .order('asset_class')
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('assets-table-body').innerHTML =
      `<tr><td colspan="8"><div class="assets-empty"><div class="empty-icon">⚠️</div>${error.message}</div></td></tr>`;
    return;
  }

  renderAssetsTable(data || []);
}

function renderAssetsTable(assets) {
  const tbody = document.getElementById('assets-table-body');

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
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="assets-empty">
        <div class="empty-icon">🏦</div>
        No assets yet.<br/>Click <b>+ Add Asset</b> to get started.
      </div></td></tr>`;
    return;
  }

  // Group by asset_class
  const groups = {};
  assets.forEach(a => {
    const cls = a.asset_class || 'Other';
    if (!groups[cls]) groups[cls] = [];
    groups[cls].push(a);
  });

  let html = '';
  for (const [cls, items] of Object.entries(groups)) {
    html += `<tr class="asset-class-row"><td colspan="8">📂 ${cls}</td></tr>`;
    items.forEach(a => {
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

      html += `
        <tr data-id="${a.id}">
          <td><b>${a.category || '—'}</b></td>
          <td>${a.platform || '—'}</td>
          <td style="font-family:monospace;font-size:12px">${a.account_number || '—'}</td>
          <td style="font-family:monospace;font-size:12px">${a.sb_account_number || '—'}</td>
          <td style="text-align:right">${invested ? INR(invested) : '—'}</td>
          <td style="text-align:right;font-weight:600">${current ? INR(current) : '—'}</td>
          <td style="text-align:right">
            <span class="gain-badge ${badgeCls}">${gainLabel}</span>
          </td>
          <td>
            <button class="asset-delete-btn" data-id="${a.id}" title="Delete">🗑</button>
          </td>
        </tr>`;
    });
  }
  tbody.innerHTML = html;

  // Delete handlers
  tbody.querySelectorAll('.asset-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this asset?')) return;
      await deleteAsset(btn.dataset.id);
    });
  });
}

async function deleteAsset(id) {
  const { error } = await sb.from('assets').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Asset deleted', 'success');
  loadAssets(_currentUserId);
}

// ── Add Asset Modal ───────────────────────────────────────────
const addAssetModal = document.getElementById('add-asset-modal');

function openAddAssetModal() {
  ['af-asset-class', 'af-category', 'af-platform', 'af-account-number', 'af-sb-account', 'af-invested', 'af-current', 'af-notes']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = el.tagName === 'SELECT' ? 'Cash' : '';
    });
  addAssetModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('af-category').focus();
}

function closeAddAssetModal() {
  addAssetModal.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('add-asset-btn').addEventListener('click', openAddAssetModal);
document.getElementById('add-asset-close-btn').addEventListener('click', closeAddAssetModal);
document.getElementById('add-asset-cancel-btn').addEventListener('click', closeAddAssetModal);
addAssetModal.addEventListener('click', e => { if (e.target === addAssetModal) closeAddAssetModal(); });

document.getElementById('add-asset-save-btn').addEventListener('click', async () => {
  const assetClass = document.getElementById('af-asset-class').value.trim();
  const category = document.getElementById('af-category').value.trim();

  if (!assetClass || !category) {
    showToast('Asset Class and Category are required', 'error');
    return;
  }

  const saveBtn = document.getElementById('add-asset-save-btn');
  saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

  const { error } = await sb.from('assets').insert({
    user_id: _currentUserId,
    asset_class: assetClass,
    category: category,
    platform: document.getElementById('af-platform').value.trim() || null,
    account_number: document.getElementById('af-account-number').value.trim() || null,
    sb_account_number: document.getElementById('af-sb-account').value.trim() || null,
    invested: parseFloat(document.getElementById('af-invested').value) || 0,
    current_value: parseFloat(document.getElementById('af-current').value) || 0,
    notes: document.getElementById('af-notes').value.trim() || null,
  });

  saveBtn.textContent = '💾 Save Asset'; saveBtn.disabled = false;

  if (error) {
    showToast('Save failed: ' + error.message, 'error');
  } else {
    showToast('Asset saved! 🎉', 'success');
    closeAddAssetModal();
    loadAssets(_currentUserId);
  }
});

// Sidebar active state + page navigation
document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const page = item.dataset.page;
    const pageId = `page-${page}`;

    if (allPages.includes(pageId)) {
      navigateTo(pageId);
    } else {
      // Future pages: hide all and show a placeholder
      allPages.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
    }
  });
});