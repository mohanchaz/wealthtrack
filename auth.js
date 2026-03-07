// ─── Auth bootstrap ───────────────────────────────────────────
// MUST register onAuthStateChange at the top level — before any
// async work — so the initial SIGNED_IN event is never missed.
// If DOM fragments aren't ready yet we buffer the session and
// flush it once fragments-loaded fires.

let _fragmentsReady = false;
let _pendingSession = undefined;  // undefined = not yet received

sb.auth.onAuthStateChange((event, session) => {
  if (_fragmentsReady) {
    // Fragments are in the DOM — act immediately
    if (session?.user) {
      if (_dashboardUserId !== session.user.id) {
        _dashboardUserId = session.user.id;
        showDashboard(session.user);
      }
    } else {
      _dashboardUserId = null;
      showLogin();
    }
  } else {
    // Fragments not ready yet — buffer latest state
    _pendingSession = session;
  }
});

// ─── Wire up buttons + flush buffered session once DOM is ready ─
document.addEventListener('fragments-loaded', () => {
  _fragmentsReady = true;

  // ── Google Login ─────────────────────────────────────────────
  getLoginBtn().addEventListener('click', async () => {
    getLoginBtn().textContent = 'Redirecting…';
    getLoginBtn().disabled = true;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      showToast('Login failed: ' + error.message, 'error');
      getLoginBtn().textContent = 'Continue with Google';
      getLoginBtn().disabled = false;
    }
  });

  // ── Logout ───────────────────────────────────────────────────
  getLogoutBtn().addEventListener('click', async () => {
    await sb.auth.signOut();
    showToast('Signed out successfully', 'success');
  });

  // ── Flush buffered session (or fetch current one) ─────────────
  if (_pendingSession !== undefined) {
    // onAuthStateChange already fired — use its result
    const session = _pendingSession;
    _pendingSession = undefined;
    if (session?.user) {
      _dashboardUserId = session.user.id;
      showDashboard(session.user);
    } else {
      showLogin();
    }
  } else {
    // onAuthStateChange hasn't fired yet — ask Supabase directly
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        _dashboardUserId = session.user.id;
        showDashboard(session.user);
      } else {
        showLogin();
      }
    });
  }

}); // end fragments-loaded

// ─── Show Login ───────────────────────────────────────────────
function showLogin() {
  getDashView().classList.add('hidden');
  authView.classList.remove('hidden');
  document.title = 'FinTrack — Know Your Wealth';
}

// ─── Show Dashboard ───────────────────────────────────────────
function showDashboard(user) {
  authView.classList.add('hidden');
  getDashView().classList.remove('hidden');
  document.title = 'FinTrack — Dashboard';

  _currentUserId = user.id;

  const fullName = user.user_metadata?.full_name || user.email || 'there';
  const firstName = fullName.split(' ')[0];
  getUserNameEl().textContent = firstName;

  const avatarUrl = user.user_metadata?.avatar_url;
  if (avatarUrl) {
    getUserAvatarEl().src = avatarUrl;
    getUserAvatarEl().classList.remove('hidden');
    getUserAvatarPH().classList.add('hidden');
  } else {
    getUserAvatarPH().textContent = firstName[0].toUpperCase();
    getUserAvatarPH().classList.remove('hidden');
    getUserAvatarEl().classList.add('hidden');
  }

  if (getDashDateEl()) {
    getDashDateEl().textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  loadAllocations(user);
  // Ensure dashboard page is visible (other pages hidden)
  ['page-allocation', 'page-assets'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('page-dashboard')?.classList.remove('hidden');
  loadDashboardStats(user.id);
}


// ─── Load allocations from Supabase ───────────────────────────
async function loadAllocations(user) {
  getAllocContainer().innerHTML = '<div class="spinner"></div>';
  getAllocChartWrap().style.display = 'none';
  getAllocLegendEl().innerHTML = '';

  const { data, error } = await sb
    .from('ideal_allocations')
    .select('*')
    .eq('user_id', user.id)
    .order('percentage', { ascending: false });

  if (error) {
    getAllocContainer().innerHTML = `
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
  getAllocContainer().innerHTML = '';
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
  getAllocContainer().appendChild(list);

  // ── Donut chart ──────────────────────────────────────────
  getAllocChartWrap().style.display = 'flex';
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
  getAllocLegendEl().innerHTML = allocations.map((a, i) => `
    <div class="alloc-legend-item">
      <div class="alloc-legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      ${a.item}
    </div>`).join('');
}

// ─── Seed default allocations ─────────────────────────────────
async function seedAllocations(userId) {
  getAllocContainer().innerHTML = `
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
    getAllocContainer().innerHTML = `<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px;">Could not load allocations.</p>`;
  } else {
    showToast('Default allocations set up!', 'success');
    loadAllocations({ id: userId });
  }
}

// ══════════════════════════════════════════════════════════════
//  EDIT MODAL
// ══════════════════════════════════════════════════════════════

// ── Helper functions (module scope — usable from anywhere) ────

function openEditModal(allocations) {
  getModalRowsEl().innerHTML = '';
  allocations.forEach(a => addModalRow(a.item, (a.percentage * 100).toFixed(1)));
  updateModalTotal();
  getAllocModal().classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  getAllocModal().classList.add('hidden');
  document.body.style.overflow = '';
}

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
  getModalRowsEl().appendChild(row);
}

// ── Total badge ───────────────────────────────────────────────
function updateModalTotal() {
  let total = 0;
  getModalRowsEl().querySelectorAll('.modal-input-pct').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  total = Math.round(total * 10) / 10;
  getModalTotalBadge().className = 'modal-total-badge';

  if (Math.abs(total - 100) < 0.05) {
    getModalTotalBadge().textContent = `✓ Total: ${total}%`;
    getModalTotalBadge().classList.add('ok');
  } else if (total > 100) {
    getModalTotalBadge().textContent = `Total: ${total}% (over by ${(total - 100).toFixed(1)}%)`;
    getModalTotalBadge().classList.add('err');
  } else {
    getModalTotalBadge().textContent = `Total: ${total}% (need ${(100 - total).toFixed(1)}% more)`;
    getModalTotalBadge().classList.add('warn');
  }
}

// ── Modal event wiring (runs after fragments-loaded) ─────────
document.addEventListener('fragments-loaded', () => {
  document.getElementById('edit-alloc-btn').addEventListener('click', () => {
    if (!_currentAllocations.length) {
      showToast('No allocations to edit yet', 'info');
      return;
    }
    openEditModal(_currentAllocations);
  });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  getAllocModal().addEventListener('click', e => { if (e.target === getAllocModal()) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !getAllocModal().classList.contains('hidden')) closeModal(); });
  document.getElementById('modal-add-row-btn').addEventListener('click', () => {
    addModalRow('', '');
    const rows = getModalRowsEl().querySelectorAll('.modal-row');
    rows[rows.length - 1]?.querySelector('.modal-input-name')?.focus();
  });
  document.getElementById('modal-save-btn').addEventListener('click', saveAllocations);
}); // end modal wiring

async function saveAllocations() {
  const rows = [...getModalRowsEl().querySelectorAll('.modal-row')];
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

  // Reset sidebar scroll to top on every navigation
  const sidebar = document.querySelector('.dash-sidebar');
  if (sidebar) sidebar.scrollTop = 0;

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