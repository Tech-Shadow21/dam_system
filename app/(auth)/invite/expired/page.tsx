import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Invite expired — Vaultra' }

/**
 * The documented copy for an expired invite: explains what happened and what to
 * do, rather than a generic broken-link page (03-security-access.md edge cases).
 */
export default function InviteExpiredPage() {
  return (
    <div>
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
        <svg
          className="h-6 w-6 text-warning-ink"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7.5V12l3 2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h1 className="font-display text-display font-medium text-ink">
        This invite has expired
      </h1>
      <p className="mt-3 text-body-sm text-ink-secondary">
        Ask an admin to resend it. Invite links are single-use and time-limited,
        so a link that has already been opened will show this message too.
      </p>

      <div className="mt-8">
        <Link
          href="/login"
          className="text-body-sm font-medium text-primary underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
