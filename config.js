// ─── Supabase Config ──────────────────────────────────────────
// NOTE: this file is listed in .gitignore — credentials stay out of git.
// On Cloudflare Pages, deploy this file manually via the dashboard or CI.
const SUPABASE_URL = 'https://kgcuogyrxcbdlozgnfav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnY3VvZ3lyeGNiZGxvemduZmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzY0MDMsImV4cCI6MjA4ODAxMjQwM30.kEI2A8o3rxRJAgncH9gzxeFhB6PYyvLQ8IwKOTuAQ3U';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


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
  'Fixed Deposits': 'bank_fd_assets',
  'Emergency Funds': 'emergency_funds',
  'Bonds': 'bonds',
  'AMC Mutual Funds': 'amc_mf_holdings',
  'Zerodha Stocks': 'zerodha_stocks',
  'Aionion Stocks': 'aionion_stocks',
  'Aionion Gold':   'aionion_gold',
  'Mutual Funds': 'mf_holdings',
  'Gold': 'gold_holdings',
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
    { key: 'interest_rate', label: 'Interest', align: 'right', fmt: 'pct' },
    { key: 'maturity_date', label: 'Maturity Date', align: 'right', fmt: 'date' },
    { key: 'maturity_amount', label: 'Maturity Amt', align: 'right', fmt: 'inr' },
  ],
  emergency_funds: [
    { key: 'category', label: 'Category', bold: true },
    { key: 'platform', label: 'Platform' },
    { key: 'account_number', label: 'Account No.', mono: true },
    { key: 'sb_account_number', label: 'SB Account No.', mono: true },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'invested_date', label: 'Invested Date', align: 'right', fmt: 'date' },
    { key: 'interest_rate', label: 'Interest', align: 'right', fmt: 'pct' },
    { key: 'maturity_date', label: 'Maturity Date', align: 'right', fmt: 'date' },
    { key: 'maturity_amount', label: 'Maturity Amt', align: 'right', fmt: 'inr' },
  ],
  bonds: [
    { key: 'name',             label: 'Name',           bold: true },
    { key: 'platform',         label: 'Platform' },
    { key: 'isin',             label: 'ISIN',           mono: true },
    { key: 'bond_id',          label: 'ID',             mono: true },
    { key: 'sb_account_number',label: 'SB Account',     mono: true },
    { key: 'invested',         label: 'Invested',       align: 'right', fmt: 'inr' },
    { key: 'interest_rate',    label: 'Interest',       align: 'right', fmt: 'pct' },
    { key: 'face_value',       label: 'Face Value',     align: 'right', fmt: 'inr' },
    { key: 'purchase_date',    label: 'Purchase Date',  align: 'right', fmt: 'date' },
    { key: 'maturity_date',    label: 'Maturity Date',  align: 'right', fmt: 'date' },
  ],
  amc_mf_holdings: [
    { key: '_name',        label: 'Fund Name',     bold: true, fmt: 'name' },
    { key: 'platform',     label: 'Platform' },
    { key: 'folio_number', label: 'Folio No.',     mono: true },
    { key: 'qty',          label: 'Units',         align: 'right' },
    { key: 'avg_cost',     label: 'Avg NAV',       align: 'right', fmt: 'inr' },
    { key: '_live_nav',    label: 'Live NAV',      align: 'right' },
    { key: 'invested',     label: 'Invested',      align: 'right', fmt: 'inr' },
    { key: 'current_value',label: 'Cur. Value',    align: 'right', fw: '600' },
    { key: '_alloc_pct',   label: 'Allocation',    align: 'right' },
  ],
  zerodha_stocks: [
    { key: 'instrument', label: 'Instrument', bold: true },
    { key: '_name', label: 'Company', fmt: 'name' },
    { key: 'qty', label: 'Qty', align: 'right' },
    { key: '_qty_diff', label: 'Qty Diff', align: 'right', fmt: 'qty_diff' },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', fmt: 'inr' },
    { key: '_ltp', label: 'LTP', align: 'right', fmt: 'inr', fw: '600' },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Cur. Value', align: 'right', fmt: 'inr', fw: '600' },
    { key: '_alloc_pct', label: 'Allocation', align: 'right', fmt: 'alloc_pct' },
  ],
  mf_holdings: [
    { key: 'fund_name', label: 'Fund Name', bold: true },
    { key: 'qty', label: 'Units', align: 'right' },
    { key: '_qty_diff', label: 'Units Diff', align: 'right', fmt: 'qty_diff' },
    { key: 'avg_cost', label: 'Avg NAV', align: 'right', fmt: 'inr' },
    { key: '_live_nav', label: 'Live NAV', align: 'right', fmt: 'inr', fw: '600' },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Cur. Value', align: 'right', fmt: 'inr', fw: '600' },
    { key: '_alloc_pct', label: 'Allocation', align: 'right', fmt: 'alloc_pct' },
  ],
  gold_holdings: [
    { key: 'holding_name', label: 'Name', bold: true },
    { key: 'holding_type', label: 'Type', fmt: 'gold_type' },
    { key: 'qty', label: 'Qty / Units', align: 'right' },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', fmt: 'inr' },
    { key: '_ltp', label: 'LTP / NAV', align: 'right', fmt: 'inr', fw: '600' },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Cur. Value', align: 'right', fmt: 'inr', fw: '600' },
    { key: '_alloc_pct', label: 'Allocation', align: 'right', fmt: 'alloc_pct' },
  ],
  aionion_stocks: [
    { key: 'instrument', label: 'Instrument', bold: true },
    { key: '_name', label: 'Company', fmt: 'name' },
    { key: 'qty', label: 'Qty', align: 'right' },
    { key: '_qty_diff', label: 'Qty Diff', align: 'right', fmt: 'qty_diff' },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', fmt: 'inr' },
    { key: '_ltp', label: 'LTP', align: 'right', fmt: 'inr', fw: '600' },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Cur. Value', align: 'right', fmt: 'inr', fw: '600' },
    { key: '_alloc_pct', label: 'Allocation', align: 'right', fmt: 'alloc_pct' },
  ],
  aionion_gold: [
    { key: 'instrument', label: 'Instrument', bold: true },
    { key: 'qty', label: 'Qty', align: 'right' },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', fmt: 'inr' },
    { key: '_ltp', label: 'LTP', align: 'right', fmt: 'inr', fw: '600' },
    { key: 'invested', label: 'Invested', align: 'right', fmt: 'inr' },
    { key: 'current_value', label: 'Cur. Value', align: 'right', fmt: 'inr', fw: '600' },
    { key: '_alloc_pct', label: 'Allocation', align: 'right', fmt: 'alloc_pct' },
  ],
};

function formatCell(val, fmt) {
  if (val === null || val === undefined || val === '') return '—';
  switch (fmt) {
    case 'name': return `<span style="color:var(--muted);font-size:12px">${val || '—'}</span>`;
    case 'gold_type': return val === 'ETF'
      ? `<span style="background:#fff3cd;color:#856404;padding:1px 7px;border-radius:20px;font-size:11px;font-weight:600">ETF</span>`
      : `<span style="background:var(--accentbg);color:var(--accent);padding:1px 7px;border-radius:20px;font-size:11px;font-weight:600">MF</span>`;
    case 'fund_name': {
      const parts = (val || '').split('||');
      const name   = parts[0] || val;
      const ticker = parts[1] || '';
      return `<span style="display:flex;flex-direction:column;gap:1px">
        <b>${name}</b>
        ${ticker ? `<span style="font-size:10.5px;color:var(--muted2);font-weight:400">${ticker.replace(/\.(NS|BO)$/, '')}</span>` : ''}
      </span>`;
    }
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