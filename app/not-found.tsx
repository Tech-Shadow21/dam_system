import Link from 'next/link'
import type { Metadata } from 'next'
import { buttonClasses } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Not found — Vaultra' }

/**
 * 404. Reached both for unknown URLs and for records the caller can't see —
 * RLS makes another organization's asset indistinguishable from one that doesn't
 * exist, which is the intended behaviour.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="max-w-[480px] text-center">
        <p className="font-mono text-meta uppercase tracking-wider text-ink-secondary">
          404
        </p>
        <h1 className="mt-3 font-display text-display font-medium text-ink">
          We couldn&rsquo;t find that
        </h1>
        <p className="mt-3 text-body-sm text-ink-secondary">
          The page or asset may have been moved or removed, or you may not have
          access to it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={buttonClasses({ variant: 'primary' })}>
            Back to home
          </Link>
          <Link href="/library" className={buttonClasses({ variant: 'secondary' })}>
            Browse library
          </Link>
        </div>
      </div>
    </div>
  )
}
