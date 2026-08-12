'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'

/** Error boundary for every authenticated route (TICKET-019). */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side causes are already logged; this captures client-side throws.
    console.error('[dashboard error boundary]', error)
  }, [error])

  return (
    <div className="py-8">
      <ErrorState reset={reset} digest={error.digest} />
    </div>
  )
}
