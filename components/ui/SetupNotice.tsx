import { cn } from '@/lib/utils'

/**
 * Shown when Supabase credentials are absent or still placeholders.
 *
 * This build was authored without a live Supabase project, so rather than
 * failing with an opaque network error, the app states plainly what is missing
 * and what to do about it.
 */
export function SetupNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-card border border-warning/40 bg-warning/5 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-[2px] h-5 w-5 shrink-0 text-warning-ink"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 4l9 16H3l9-16z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 10v4M12 17v.01"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <div className="min-w-0">
          <p className="text-body-sm font-medium text-ink">Supabase is not configured</p>
          <p className="mt-1 text-meta text-ink-secondary">
            Authentication, uploads and storage need a live Supabase project. Add
            your credentials to{' '}
            <code className="font-mono text-meta-sm text-ink">.env.local</code>,
            then apply the migrations in{' '}
            <code className="font-mono text-meta-sm text-ink">
              supabase/migrations/
            </code>
            .
          </p>
          <ul className="mt-3 space-y-1 font-mono text-meta-sm text-ink-secondary">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
            <li>SUPABASE_STORAGE_BUCKET</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
