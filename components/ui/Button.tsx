import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'hero' | 'secondary' | 'destructive' | 'ghost'
type Size = 'default' | 'compact'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

/**
 * Button per 04-frontend-specification.md:
 * - primary: solid navy, white text, 6px radius, subtle shadow on hover
 * - hero: the single hero action per screen — navy that shifts to brass with dark
 *   navy text on hover (e.g. "Upload", "Create Share Link")
 * - secondary: 1px line border, transparent bg, border darkens on hover
 * - destructive: error text on transparent, fills solid on hover
 * Sizing: 40px default, 32px compact, 16px horizontal padding.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover hover:shadow-control active:bg-primary-hover',
  hero: 'bg-primary text-white hover:bg-accent hover:text-primary hover:shadow-control',
  secondary:
    'border border-line bg-transparent text-ink hover:border-ink-secondary hover:bg-primary/[0.02]',
  destructive:
    'bg-transparent text-error hover:bg-error hover:text-white border border-transparent hover:border-error',
  ghost: 'bg-transparent text-ink-secondary hover:bg-primary/[0.04] hover:text-ink',
}

const sizes: Record<Size, string> = {
  default: 'h-10 px-4',
  compact: 'h-8 px-4 text-meta',
}

/**
 * Shared class builder, so a `Link` can carry button styling without needing an
 * `asChild`/Slot indirection. Use for navigation; use `<Button>` for actions.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'default',
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
} = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-control font-sans text-button font-medium',
    'transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-40',
    variants[variant],
    sizes[size],
    className
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'default', loading = false, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
          />
        </svg>
      )}
      {children}
    </button>
  )
})
