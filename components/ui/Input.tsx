'use client'

import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

interface FieldShellProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

/**
 * Shared label/error scaffolding. Labels sit above the field in Plex Sans 13px
 * #5B6472 per 04-frontend-specification.md.
 */
export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-meta font-medium text-ink-secondary">
          {label}
          {required && (
            <span className="ml-1 text-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-meta-sm text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-meta-sm text-ink-secondary">{hint}</p>
      ) : null}
    </div>
  )
}

/** Focus: navy border + soft 2px navy-at-10% ring. Error: error border + helper text. */
const controlBase =
  'w-full rounded-control border bg-surface px-3 font-sans text-body-sm text-ink placeholder:text-ink-secondary ' +
  'transition-colors duration-150 outline-none ' +
  'focus:border-primary focus:shadow-focus ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-60'

const controlState = (hasError?: boolean) =>
  hasError
    ? 'border-error focus:border-error focus:shadow-focus-error'
    : 'border-line'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, mono, id, required, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={inputId}
    >
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${inputId}-error` : undefined}
        className={cn(
          controlBase,
          controlState(!!error),
          'h-10',
          mono && 'font-mono text-meta',
          className
        )}
        {...props}
      />
    </Field>
  )
})

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, error, hint, id, required, ...props }, ref) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    return (
      <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(controlBase, controlState(!!error), 'min-h-[80px] py-2', className)}
          {...props}
        />
      </Field>
    )
  }
)

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, hint, id, required, children, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(controlBase, controlState(!!error), 'h-10 pr-8', className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
})

/** Checkbox with brass accent for the checked state. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }
>(function Checkbox({ className, label, id, ...props }, ref) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          'h-4 w-4 cursor-pointer rounded-[3px] border-line text-primary',
          'accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className
        )}
        {...props}
      />
      {label && (
        <label htmlFor={inputId} className="cursor-pointer text-body-sm text-ink">
          {label}
        </label>
      )}
    </div>
  )
})
