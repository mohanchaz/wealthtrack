import { supabase } from '../lib/supabase'

export async function sendCSVByEmail(
  userId:         string,
  userEmail:      string,
  userName:       string,
  recipientEmail: string,
): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${supabaseUrl}/functions/v1/send-csv-export`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey':        anonKey,
    },
    body: JSON.stringify({ userId, userEmail, userName, recipientEmail }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? data.message ?? `Edge function error (${res.status})`)
}
