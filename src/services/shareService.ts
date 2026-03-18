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
    .neq('owner_id', user.id)   // exclude own grants (self-share)

  if (error || !data) {
    console.error('[shareService] fetchSharedProfiles error:', error?.message)
    return []
  }

  // Return all profiles — even if owner_email/owner_name are empty (old rows).
  // The UI shows a fallback label. User should revoke & re-grant to populate fields.
  return (data as SharedProfile[]).filter(p => !!p.owner_id)
}

// ── For the owner — list who they've granted access to ───────────────────────
export async function fetchAccessGrants(): Promise<AccessGrant[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('profile_access')
    .select('id, viewer_email, created_at')
    .eq('owner_id', user.id)          // only rows THIS user created as owner
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

// ── Allowed users (admin only) ────────────────────────────────────────────────

export interface AllowedUser {
  email:      string
  label:      string | null
  added_at:   string
}

// Check if current user has Owner label in allowed_users.
// A user can always read their own row (existing RLS policy), so this
// works without any extra migration — just set label = 'Owner' in the DB.
export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false

  const { data, error } = await supabase
    .from('allowed_users')
    .select('label')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (error) return false
  return data?.label === 'Owner'
}

// List all allowed users (admin only)
export async function fetchAllowedUsers(): Promise<AllowedUser[]> {
  const { data, error } = await supabase
    .from('allowed_users')
    .select('email, label, added_at')
    .order('added_at', { ascending: false })

  if (error || !data) return []
  return data as AllowedUser[]
}

// Add a user to the allowlist (admin only)
export async function addAllowedUser(email: string, label?: string): Promise<string | null> {
  const { error } = await supabase
    .from('allowed_users')
    .insert({ email: email.toLowerCase().trim(), label: label || null })

  if (error) {
    if (error.code === '23505') return 'This email is already on the allowlist.'
    return error.message
  }
  return null
}

// Remove a user from the allowlist (admin only)
export async function removeAllowedUser(email: string): Promise<string | null> {
  const { error } = await supabase
    .from('allowed_users')
    .delete()
    .eq('email', email.toLowerCase())

  return error?.message ?? null
}
