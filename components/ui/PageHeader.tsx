import { cn } from '@/lib/utils'

/**
 * Page title block. Fraunces display size per the type scale, with a 24px
 * vertical rhythm to the content below.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-display font-medium text-ink">{title}</h1>
          {description && (
            <p className="mt-2 max-w-content text-body-sm text-ink-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** Section heading inside a page — Fraunces 20px. */
export function SectionHeading({
  children,
  actions,
  className,
}: {
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-4', className)}>
      <h2 className="font-display text-heading-sm font-medium text-ink">{children}</h2>
      {actions}
    </div>
  )
}
