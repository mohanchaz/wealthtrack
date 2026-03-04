// ─── Supabase client ─────────────────────────────────────────
// SUPABASE_URL, SUPABASE_ANON_KEY and `sb` are injected at runtime
// by the Cloudflare Pages Function at functions/config.js.
// Set SUPABASE_URL and SUPABASE_ANON_KEY in the Cloudflare Pages dashboard.


// ─── Static DOM refs (present in index.html before loader runs) ─
const authView = document.getElementById('auth-view');
// dashView is replaced by loader.js (replaceWith) so we use a lazy getter
const getDashView = () => document.getElementById('dashboard-view');
const toastEl = document.getElementById('toast');

// ─── Lazy DOM getters (elements injected by loader.js) ─────────
// Use these functions instead of caching refs at parse time,
// because the elements don't exist until fragments-loaded fires.
const getLoginBtn = () => document.getElementById('login-btn');
const getLogoutBtn = () => document.getElementById('logout-btn');
const getUserNameEl = () => document.getElementById('user-name');
const getUserAvatarEl = () => document.getElementById('user-avatar');
const getUserAvatarPH = () => document.getElementById('user-avatar-placeholder');
const getDashDateEl = () => document.getElementById('dash-date');
const getAllocContainer = () => document.getElementById('allocations-container');
const getAllocChartWrap = () => document.getElementById('alloc-chart-wrap');
const getAllocLegendEl = () => document.getElementById('alloc-legend');
const getAllocModal = () => document.getElementById('alloc-modal');
const getModalRowsEl = () => document.getElementById('modal-rows');
const getModalTotalBadge = () => document.getElementById('modal-total-badge');

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


const INR = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Map asset-class name → Supabase table name
const ASSET_TABLES = {
  'Cash': 'cash_assets',
  'Bank FD': 'bank_fd_assets',
  'Zerodha Stocks': 'zerodha_stocks',
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
  zerodha_stocks: [
    { key: 'instrument', label: 'Instrument', bold: true },
    { key: 'qty', label: 'Qty', align: 'right' },
    { key: '_qty_diff', label: 'Qty Diff', align: 'right', fmt: 'qty_diff' },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', fmt: 'inr' },
    { key: 'ltp', label: 'LTP', align: 'right', fmt: 'inr' },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Cur. Value', align: 'right', fmt: 'inr', fw: '600' },
    { key: '_alloc_pct', label: 'Allocation', align: 'right', fmt: 'alloc_pct' },
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
    case 'qty_diff': {
      const n = +val;
      if (!n || isNaN(n)) return '<span style="color:var(--muted2)">—</span>';
      const arrow = n > 0 ? '▲' : '▼';
      const color = n > 0 ? 'var(--green)' : 'var(--danger)';
      return `<span style="color:${color};font-weight:600">${arrow} ${Math.abs(n)}</span>`;
    }
    case 'alloc_pct': {
      const n = +val;
      if (!n || isNaN(n)) return '<span style="color:var(--muted2)">—</span>';
      const barWidth = Math.min(n, 100).toFixed(1);
      return `<span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="width:48px;height:5px;background:var(--border2);border-radius:99px;overflow:hidden;display:inline-block">
          <span style="display:block;height:100%;width:${barWidth}%;background:var(--accent);border-radius:99px"></span>
        </span>
        <b style="font-size:12px;color:var(--accent)">${n.toFixed(1)}%</b>
      </span>`;
    }
    default: return val;
  }
}

let _currentAssetTable = null;
let _currentAssetFilter = null;
