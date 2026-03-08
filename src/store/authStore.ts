import { create } from 'zustand'
import type { User, Session } from '../types'
import { supabase } from '../lib/supabase'

interface AuthState {
  user:    User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail:  (email: string, password: string) => Promise<string | null>
  signOut:          () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user:    null,
  session: null,
  loading: true,

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
    set({ user: null, session: null })
  },
}))

// Bootstrap: sync Supabase auth events into the store
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({
    user:    session?.user ?? null,
    session: session ?? null,
    loading: false,
  })
})
