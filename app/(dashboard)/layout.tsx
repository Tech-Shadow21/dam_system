import { requireSession } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'

/**
 * Never statically cache anything behind auth.
 *
 * Next infers dynamic rendering from cookies() access, which normally happens
 * via requireSession(). Stating it explicitly means a refactor that short-
 * circuits before reading cookies can't silently turn a tenant-scoped page into
 * a shared static asset — the failure mode would be a cross-tenant data leak.
 */
export const dynamic = 'force-dynamic'

/**
 * Authenticated shell. requireSession() redirects unauthenticated (or
 * deactivated) visitors to /login before any dashboard chrome renders.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, organization } = await requireSession()

  return (
    <>
      {/* Skip link — first focusable element on every authenticated page. */}
      <a
        href="#main-content"
        className="sr-only-focusable absolute left-4 top-4 z-[70] rounded-control bg-primary px-4 py-2 text-body-sm font-medium text-white"
      >
        Skip to main content
      </a>
      <AppShell
        role={profile.role}
        fullName={profile.full_name}
        email={profile.email}
        organizationName={organization.name}
      >
        {children}
      </AppShell>
    </>
  )
}
