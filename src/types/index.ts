import type { User, Session } from '@supabase/supabase-js'
export type { User, Session }

// ── Allocation ───────────────────────────────────────────────
export interface IdealAllocation {
  id:          string
  user_id:     string
  item:        string
  type:        string
  category:    string
  percentage:  number
  created_at?: string
}


// ── Toasts ─────────────────────────────────────────────────────
export type ToastType = 'info' | 'success' | 'error'

export interface Toast {
  id:      string
  message: string
  type:    ToastType
}
