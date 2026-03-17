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
// Returns true  → user is on the list, let them in
// Returns false → user is not on the list, deny access
// Returns null  → table doesn't exist yet (migration not run), fail open so
//                 the app doesn't lock out everyone including the owner
async function isEmailAllowed(email: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    // Table missing (42P01) → migration hasn't been run yet, fail open
    if (error?.code === '42P01') {
      console.warn('[allowlist] allowed_users table not found — run the migration. Failing open.')
      return null
    }

    // Any other DB error → fail open to avoid locking out the owner
    if (error) {
      console.error('[allowlist] Error querying allowed_users:', error.message)
      return null
    }

    return data !== null
  } catch (err) {
    console.error('[allowlist] Unexpected error:', err)
    return null
  }
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
// NOTE: onAuthStateChange callbacks are NOT awaited by Supabase.
// We fire-and-forget the async work but always guarantee loading → false,
// even if something throws, so the app never hangs on the spinner.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    const email = session.user.email ?? ''

    // Run the allowlist check asynchronously but catch everything
    isEmailAllowed(email).then((allowed) => {
      // null = table missing, fail open (let user through)
      if (allowed === false) {
        // Not on the list — sign out and show denied screen
        supabase.auth.signOut().finally(() => {
          useAuthStore.setState({
            user:         null,
            session:      null,
            loading:      false,
            accessDenied: true,
          })
        })
      } else {
        // allowed === true or null (fail open)
        useAuthStore.setState({
          user:         session.user,
          session:      session,
          loading:      false,
          accessDenied: false,
        })
      }
    }).catch(() => {
      // Last-resort catch — always resolve loading so app doesn't hang
      useAuthStore.setState({
        user:         session.user,
        session:      session,
        loading:      false,
        accessDenied: false,
      })
    })
  } else {
    // No session (signed out)
    useAuthStore.setState({
      user:         null,
      session:      null,
      loading:      false,
      accessDenied: false,
    })
  }
})
