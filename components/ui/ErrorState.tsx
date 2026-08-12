'use client'

import { Button } from '@/components/ui/Button'
import { AlertIcon } from '@/components/ui/Icon'

/**
 * Shared error-boundary body (TICKET-019).
 *
 * Uses the documented wording for an unexpected failure and always offers an
 * explicit retry — nothing is silently re-attempted, per the error-handling table
 * in 03-security-access.md.
 */
export function ErrorState({
  reset,
  title = 'Something went wrong',
  description = 'Something went wrong on our end — please try again.',
  digest,
}: {
  reset?: () => void
  title?: string
  description?: string
  digest?: string
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-card border border-error/30 bg-error/[0.03] px-6 py-12 text-center sm:py-16"
    >
      <div
        aria-hidden="true"
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error"
      >
        <AlertIcon size={22} />
      </div>

      <h2 className="font-display text-heading-sm font-medium text-ink">{title}</h2>
      <p className="mt-2 max-w-[420px] text-body-sm text-ink-secondary">{description}</p>

      {reset && (
        <div className="mt-6">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      )}

      {/* Useful when the founder is matching a user report to a server log. */}
      {digest && (
        <p className="mt-6 font-mono text-meta-sm text-ink-secondary">
          Reference: {digest}
        </p>
      )}
    </div>
  )
}
