'use client'

import { useEffect } from 'react'

/**
 * Portal error boundary. Deliberately reveals nothing about the organization or
 * why the failure happened — an external recipient shouldn't learn anything from
 * an error page.
 */
export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[share portal error boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div
        role="alert"
        className="max-w-[480px] rounded-card border border-line bg-surface px-6 py-12 text-center"
      >
        <h1 className="font-display text-heading font-medium text-ink">
          This link couldn&rsquo;t be opened
        </h1>
        <p className="mt-3 text-body-sm text-ink-secondary">
          Something went wrong on our end — please try again. If it keeps
          happening, ask the person who shared this to send a new link.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-control bg-primary px-4 font-sans text-button font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
