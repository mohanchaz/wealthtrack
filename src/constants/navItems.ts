export interface NavItem {
  id:        string
  label:     string
  icon:      string
  path:      string
  children?: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈', path: '/dashboard' },
  {
    id: 'assets', label: 'Assets', icon: '⬡', path: '/assets/overview',
    children: [
      {
        id: 'zerodha', label: 'Zerodha', icon: '📈', path: '/assets/zerodha',
        children: [
          { id: 'zerodha-stocks', label: 'Stocks',       icon: '◆', path: '/assets/zerodha-stocks' },
          { id: 'mutual-funds',   label: 'Mutual Funds', icon: '◆', path: '/assets/mutual-funds'   },
          { id: 'gold',           label: 'Gold',         icon: '◆', path: '/assets/gold'            },
        ],
      },
      {
        id: 'aionion', label: 'Aionion', icon: '📊', path: '/assets/aionion',
        children: [
          { id: 'aionion-stocks', label: 'Stocks', icon: '◆', path: '/assets/aionion-stocks' },
          { id: 'aionion-gold',   label: 'Gold',   icon: '◆', path: '/assets/aionion-gold'   },
        ],
      },
      { id: 'cash',   label: 'Cash',             icon: '◆', path: '/assets/cash'    },
      { id: 'fd',     label: 'Fixed Deposits',   icon: '◆', path: '/assets/fd'      },
      { id: 'ef',     label: 'Emergency Fund',   icon: '◆', path: '/assets/ef'      },
      { id: 'bonds',  label: 'Bonds',            icon: '◆', path: '/assets/bonds'   },
      { id: 'amc-mf', label: 'AMC Mutual Funds', icon: '◆', path: '/assets/amc-mf'  },
      {
        id: 'foreign', label: 'Foreign Assets', icon: '🌐', path: '/assets/foreign',
        children: [
          { id: 'foreign-stocks', label: 'Foreign Stocks', icon: '◆', path: '/assets/foreign-stocks' },
          { id: 'crypto',         label: 'Crypto',          icon: '◆', path: '/assets/crypto'          },
          { id: 'bank-savings',   label: 'Bank Savings',    icon: '◆', path: '/assets/bank-savings'    },
        ],
      },
    ],
  },
]

export const NAV_BOTTOM: NavItem[] = [
  { id: 'goals',      label: 'Goals',      icon: '🎯', path: '/goals'      },
  { id: 'allocation', label: 'Allocation', icon: '◎', path: '/allocation' },
  { id: 'analytics',  label: 'Analytics',  icon: '📈', path: '/analytics'  },
]
