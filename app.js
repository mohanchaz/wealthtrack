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
const allPages = ['page-dashboard', 'page-allocation'];

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

  // Load allocation data when navigating to that page
  if (pageId === 'page-allocation' && _currentUserId && !_currentAllocations.length) {
    loadAllocations({ id: _currentUserId });
  }
}

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