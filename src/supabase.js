import { createClient } from '@supabase/supabase-js'

// The publishable key is designed to ship inside the app: row-level security
// in the database decides what each signed-in user can see. Never put the
// secret / service_role key in this file.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mtxcjawvrppgvthbileo.supabase.co'
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_1O9_ZGiG-Urnz6U4Zj8j0Q_XYv3e5iJ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})
