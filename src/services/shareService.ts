import { supabase } from '../lib/supabase'

export interface SharedProfile {
  owner_id:    string
  owner_email: string
  owner_name:  string
  created_at:  string
}

export interface AccessGrant {
  id:           string
  viewer_email: string
  created_at:   string
}

// ── For the viewer — fetch all profiles shared with current user ──────────────
// Reads owner_email/owner_name directly from profile_access — no auth.users join needed
export async function fetchSharedProfiles(): Promise<SharedProfile[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return []

  const { data, error } = await supabase
    .from('profile_access')
    .select('owner_id, owner_email, owner_name, created_at')
    .eq('viewer_email', user.email.toLowerCase())

  if (error || !data) {
    console.error('[shareService] fetchSharedProfiles error:', error?.message)
    return []
  }

  return data as SharedProfile[]
}

// ── For the owner — list who they've granted access to ───────────────────────
export async function fetchAccessGrants(): Promise<AccessGrant[]> {
  const { data, error } = await supabase
    .from('profile_access')
    .select('id, viewer_email, created_at')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as AccessGrant[]
}

// ── Grant access to a viewer ─────────────────────────────────────────────────
// Stores the owner's own email and name so viewers can display it without a join
export async function grantAccess(viewerEmail: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Not authenticated'

  const ownerEmail = user.email ?? ''
  const ownerName  = user.user_metadata?.full_name ?? user.email ?? ''

  const { error } = await supabase
    .from('profile_access')
    .insert({
      owner_id:     user.id,
      owner_email:  ownerEmail,
      owner_name:   ownerName,
      viewer_email: viewerEmail.toLowerCase().trim(),
    })

  if (error) {
    if (error.code === '23505') return 'This person already has access.'
    return error.message
  }
  return null
}

// ── Revoke access ─────────────────────────────────────────────────────────────
export async function revokeAccess(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('profile_access')
    .delete()
    .eq('id', id)

  return error?.message ?? null
}
