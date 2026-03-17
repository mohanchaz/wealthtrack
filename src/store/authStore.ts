import { create } from 'zustand'
import type { User, Session } from '../types'
import { supabase } from '../lib/supabase'
import { fetchSharedProfiles, type SharedProfile } from '../services/shareService'

interface AuthState {
  user:           User | null
  session:        Session | null
  loading:        boolean
  accessDenied:   boolean
  sharedProfiles: SharedProfile[]
  activeProfileId: string | null   // null = own profile
  signInWithGoogle:  () => Promise<void>
  signInWithEmail:   (email: string, password: string) => Promise<string | null>
  signOut:           () => Promise<void>
  clearAccessDenied: () => void
  switchProfile:     (ownerId: string | null) => void
  refreshSharedProfiles: () => Promise<void>
}

// ── Allowlist check ───────────────────────────────────────────────────────────
async function isEmailAllowed(email: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (error?.code === '42P01') {
      console.warn('[allowlist] allowed_users table not found — run the migration. Failing open.')
      return null
    }
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  session:         null,
  loading:         true,
  accessDenied:    false,
  sharedProfiles:  [],
  activeProfileId: null,

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
    set({ user: null, session: null, accessDenied: false, sharedProfiles: [], activeProfileId: null })
  },

  clearAccessDenied: () => {
    set({ accessDenied: false })
  },

  switchProfile: (ownerId) => {
    set({ activeProfileId: ownerId })
  },

  refreshSharedProfiles: async () => {
    const profiles = await fetchSharedProfiles()
    set({ sharedProfiles: profiles })
  },
}))

// ── Bootstrap: sync Supabase auth events → store ─────────────────────────────
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    const email = session.user.email ?? ''
    const allowed = isEmailAllowed(email)

    allowed.then((result) => {
      if (result === false) {
        supabase.auth.signOut().finally(() => {
          useAuthStore.setState({
            user:            null,
            session:         null,
            loading:         false,
            accessDenied:    true,
            sharedProfiles:  [],
            activeProfileId: null,
          })
        })
      } else {
        useAuthStore.setState({
          user:         session.user,
          session:      session,
          loading:      false,
          accessDenied: false,
        })
        // Fetch shared profiles after successful login
        fetchSharedProfiles().then(profiles => {
          useAuthStore.setState({ sharedProfiles: profiles })
        })
      }
    }).catch(() => {
      useAuthStore.setState({
        user:         session.user,
        session:      session,
        loading:      false,
        accessDenied: false,
      })
    })
  } else {
    useAuthStore.setState({
      user:            null,
      session:         null,
      loading:         false,
      accessDenied:    false,
      sharedProfiles:  [],
      activeProfileId: null,
    })
  }
})
