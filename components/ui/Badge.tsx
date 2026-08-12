import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'accent' | 'success' | 'error' | 'warning' | 'primary'

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-secondary border-line',
  accent: 'bg-accent-muted text-[#8A6D28] border-accent/30',
  success: 'bg-success/10 text-success border-success/25',
  error: 'bg-error/10 text-error border-error/25',
  warning: 'bg-warning/10 text-[#8A5E1B] border-warning/30',
  primary: 'bg-primary-muted text-primary border-primary/20',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  mono?: boolean
}

/** Status pill — used for share-link status, user role/status, version numbers. */
export function Badge({
  className,
  tone = 'neutral',
  mono = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-meta-sm font-medium',
        mono && 'font-mono',
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export interface TagChipProps {
  label: string
  onRemove?: () => void
  className?: string
}

/** Tag chip shown on asset cards and the detail view (TICKET-012). */
export function TagChip({ label, onRemove, className }: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-canvas',
        'px-2 py-[2px] text-meta-sm text-ink-secondary',
        className
      )}
    >
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="-mr-[2px] shrink-0 rounded-full p-[2px] text-ink-secondary transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  )
}
