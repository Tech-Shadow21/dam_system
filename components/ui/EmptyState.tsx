import { cn } from '@/lib/utils'

/**
 * Designed empty state — never a blank page (TICKET-019).
 *
 * Fraunces carries the headline, matching the spec's note that empty states are
 * one of the moments where the serif voice matters.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface/60 text-center',
        compact ? 'px-6 py-8' : 'px-6 py-12 sm:py-16',
        className
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-secondary"
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-heading-sm font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-[420px] text-body-sm text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
