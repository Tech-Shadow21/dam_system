import { cn } from '@/lib/utils'

/**
 * Card per 04-frontend-specification.md: white surface, 8px radius, 1px line
 * border, no heavy shadow at rest — shadow only on hover/drag so the grid stays
 * calm at scale. Selected state is a 2px brass border, never a color fill.
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  interactive?: boolean
  selected?: boolean
  as?: 'div' | 'article' | 'li'
}

export function Card({
  className,
  interactive = false,
  selected = false,
  as: Tag = 'div',
  children,
  ...props
}: CardProps) {
  // Polymorphic tag: the shared HTMLAttributes surface is compatible across
  // div/article/li, but TS can't prove it for the element-specific handlers.
  const Component = Tag as React.ElementType

  return (
    <Component
      className={cn(
        'rounded-card border bg-surface transition-shadow duration-150',
        selected ? 'border-2 border-accent' : 'border-line',
        interactive && 'hover:shadow-card',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border-b border-line px-6 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('font-display text-heading-sm font-medium text-ink', className)}
      {...props}
    >
      {children}
    </h2>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-body-sm text-ink-secondary', className)} {...props}>
      {children}
    </p>
  )
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 border-t border-line px-6 py-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
