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
export async function fetchSharedProfiles(): Promise<SharedProfile[]> {
  const { data, error } = await supabase
    .from('profile_access')
    .select('owner_id, created_at, owner:owner_id(email, raw_user_meta_data)')
    .neq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')

  if (error || !data) return []

  return data.map((row: any) => ({
    owner_id:    row.owner_id,
    owner_email: row.owner?.email ?? '',
    owner_name:  row.owner?.raw_user_meta_data?.full_name ?? row.owner?.email ?? '',
    created_at:  row.created_at,
  }))
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
export async function grantAccess(viewerEmail: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Not authenticated'

  const { error } = await supabase
    .from('profile_access')
    .insert({ owner_id: user.id, viewer_email: viewerEmail.toLowerCase().trim() })

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
