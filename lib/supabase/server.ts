import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 * Uses the anon key on the caller's session, so RLS applies — this is the
 * default for all app data access.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware, so this is safe to ignore.
        }
      },
    },
  })
}
