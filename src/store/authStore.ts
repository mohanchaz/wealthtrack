import { create } from 'zustand'
import type { User, Session } from '../types'
import { supabase } from '../lib/supabase'

interface AuthState {
  user:         User | null
  session:      Session | null
  loading:      boolean
  accessDenied: boolean
  signInWithGoogle:  () => Promise<void>
  signInWithEmail:   (email: string, password: string) => Promise<string | null>
  signOut:           () => Promise<void>
  clearAccessDenied: () => void
}

// ── Allowlist check ───────────────────────────────────────────────────────────
// Queries the allowed_users table for the signed-in user's own email.
// RLS ensures a user can only ever read their own row.
async function isEmailAllowed(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  return !error && data !== null
}

export const useAuthStore = create<AuthState>((set) => ({
  user:         null,
  session:      null,
  loading:      true,
  accessDenied: false,

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: window.location.origin },
    })
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, accessDenied: false })
  },

  clearAccessDenied: () => {
    set({ accessDenied: false })
  },
}))

// ── Bootstrap: sync Supabase auth events → store ─────────────────────────────
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    const email = session.user.email ?? ''
    const allowed = await isEmailAllowed(email)

    if (!allowed) {
      // Sign the user out immediately and surface the access-denied state
      await supabase.auth.signOut()
      useAuthStore.setState({
        user:         null,
        session:      null,
        loading:      false,
        accessDenied: true,
      })
      return
    }
  }

  useAuthStore.setState({
    user:         session?.user ?? null,
    session:      session       ?? null,
    loading:      false,
    accessDenied: false,
  })
})
