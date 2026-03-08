import type { User, Session } from '@supabase/supabase-js'
export type { User, Session }

// ── Allocation ─────────────────────────────────────────────────
export interface IdealAllocation {
  id:         string
  user_id:    string
  item:       string
  type:       string
  category:   string
  percentage: number   // decimal, e.g. 0.36 = 36%
  created_at?: string
}

// ── Dashboard stats ────────────────────────────────────────────
export interface DashboardStats {
  totalValue:     number
  totalInvested:  number
  actualInvested: number
  assetCount:     number
  entryLabel:     string
}

// ── Toast ──────────────────────────────────────────────────────
export type ToastType = 'info' | 'success' | 'error'
export interface Toast {
  id:      string
  message: string
  type:    ToastType
}
