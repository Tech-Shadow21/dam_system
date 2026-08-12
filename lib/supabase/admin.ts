import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Service-role client. BYPASSES RLS — used sparingly, only for operations that
 * genuinely cannot run under a user's session:
 *
 *  - signup bootstrap (creating an organization + its first Owner, before any
 *    membership row exists to authorise against)
 *  - invite creation and acceptance (acting on a user who is not yet active)
 *  - share-link token resolution for the public portal (the visitor has no
 *    session at all)
 *  - writing sharp-generated thumbnail variants back to Storage
 *
 * The `server-only` import above makes it a build error to reach this from a
 * client component, so the key can never end up in a browser bundle.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
