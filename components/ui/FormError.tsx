import { cn } from '@/lib/utils'

/** Form-level error banner, for failures that aren't tied to one field. */
export function FormError({
  message,
  className,
}: {
  message?: string | null
  className?: string
}) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-control border border-error/30 bg-error/5 p-3',
        className
      )}
    >
      <svg
        className="mt-[1px] h-4 w-4 shrink-0 text-error"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v5M10 14v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-body-sm text-error">{message}</p>
    </div>
  )
}

/** Success/confirmation banner counterpart. */
export function FormSuccess({
  message,
  className,
}: {
  message?: string | null
  className?: string
}) {
  if (!message) return null
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-control border border-success/30 bg-success/5 p-3',
        className
      )}
    >
      <svg
        className="mt-[1px] h-4 w-4 shrink-0 text-success"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6 10.5l2.5 2.5L14 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-body-sm text-success">{message}</p>
    </div>
  )
}
