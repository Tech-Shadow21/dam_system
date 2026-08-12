import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { hasSupabaseCredentials } from '@/lib/env'
import { ROLE_LABELS } from '@/lib/permissions'
import { SetupNotice } from '@/components/ui/SetupNotice'
import { Badge } from '@/components/ui/Badge'
import { AcceptInviteForm } from './AcceptInviteForm'

export const metadata: Metadata = { title: 'Accept your invitation — Vaultra' }

/**
 * Reached only after /invite/[token] has exchanged the token for a session.
 * Landing here without one means the link was never verified, so bounce to the
 * expired screen rather than showing a form that cannot succeed.
 */
export default async function AcceptInvitePage() {
  // No live project means no invite session to verify; say so plainly.
  if (!hasSupabaseCredentials()) {
    return (
      <div>
        <h1 className="font-display text-display font-medium text-ink">
          Accept your invitation
        </h1>
        <SetupNotice className="mt-6" />
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/invite/expired')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email, role, status, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  // Already activated — no need to set a password again.
  if (profile?.status === 'active') redirect('/')

  const { data: organization } = profile
    ? await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null }

  return (
    <div>
      <h1 className="font-display text-display font-medium text-ink">
        You&rsquo;ve been invited
      </h1>
      <p className="mt-3 text-body-sm text-ink-secondary">
        {organization?.name ? (
          <>
            Join <span className="font-medium text-ink">{organization.name}</span> on
            Vaultra. Set a password to finish setting up your account.
          </>
        ) : (
          <>Set a password to finish setting up your account.</>
        )}
      </p>

      {profile && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-control border border-line bg-canvas px-4 py-3">
          <span className="font-mono text-meta text-ink-secondary">{profile.email}</span>
          <Badge tone="accent">{ROLE_LABELS[profile.role]}</Badge>
        </div>
      )}

      <div className="mt-8">
        <AcceptInviteForm defaultFullName={profile?.full_name ?? ''} />
      </div>

      <p className="mt-6 text-meta-sm text-ink-secondary">
        Your role was set by the administrator who invited you and can&rsquo;t be
        changed here.
      </p>
    </div>
  )
}
