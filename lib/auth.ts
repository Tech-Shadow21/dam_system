import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSupabaseCredentials } from '@/lib/env'
import { can, type Permission } from '@/lib/permissions'
import type { Organization, UserRecord } from '@/types/database'

export interface SessionContext {
  authUserId: string
  profile: UserRecord
  organization: Organization
}

/**
 * Resolves the caller's profile and organization.
 *
 * Deliberately re-read from the database on every request rather than trusted
 * from the JWT: 03-security-access.md requires that a role change take effect on
 * the next request, so a demoted user loses access immediately. `cache()` scopes
 * memoisation to a single render pass, not across requests.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  // Without live credentials there can be no session. Returning null (rather
  // than letting env access throw) means every authenticated page funnels to
  // /login, which explains what's missing, instead of rendering a 500.
  if (!hasSupabaseCredentials()) return null

  const supabase = createClient()

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever is in the cookie.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // No profile row, or a deactivated account, means no access at all.
  if (!profile || profile.status === 'deactivated') return null

  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .maybeSingle()

  if (!organization) return null

  return { authUserId: user.id, profile, organization }
})

/** Guard for authenticated pages: redirects to login instead of rendering. */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) redirect('/login')
  return context
}

/**
 * Guard for permission-gated pages. Redirects to the dashboard with a notice
 * rather than rendering any part of the restricted view — per the edge case in
 * 03-security-access.md ("No partial render of restricted content").
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const context = await requireSession()
  if (!can(context.profile.role, permission)) {
    redirect('/?denied=1')
  }
  return context
}

/** Thrown by Server Actions when a role lacks the permission for an action. */
export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do this") {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * Server Action guard. Returns the session context or throws Forbidden — the
 * 403 equivalent for a direct action call with a stale session.
 */
export async function authorizeAction(permission: Permission): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')
  if (!can(context.profile.role, permission)) throw new ForbiddenError()
  return context
}
