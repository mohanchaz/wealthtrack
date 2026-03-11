import type { User, Session } from '@supabase/supabase-js'
export type { User, Session }

// ── Ideal Allocation ───────────────────────────────────────────
export interface IdealAllocation {
  id:          string
  user_id:     string
  item:        string
  type:        string
  category:    string
  percentage:  number
  created_at?: string
}

// ── Dashboard stats ────────────────────────────────────────────
export interface DashboardCategory {
  label: string
  inv:   number
  val:   number
  color: string
}

export interface DashboardStats {
  totalValue:     number
  totalInvested:  number
  actualInvested: number
  assetCount:     number
  entryLabel:     string
  categories:     DashboardCategory[]
  gbpInr:         number
}

// ── Toasts ─────────────────────────────────────────────────────
export type ToastType = 'info' | 'success' | 'error'

export interface Toast {
  id:      string
  message: string
  type:    ToastType
}
