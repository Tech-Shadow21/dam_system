'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Set false while a mutation is in flight to prevent dismissal mid-write. */
  dismissable?: boolean
}

const sizes = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
}

/**
 * Modal per 04-frontend-specification.md: centered white surface, 12px radius,
 * 24–32px internal padding, Fraunces 20px title, backdrop #1A1D23 at 40% with no
 * blur (kept snappy). Focus is trapped and restored on close for TICKET-020.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissable = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  const focusables = useCallback(() => {
    if (!panelRef.current) return [] as HTMLElement[]
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null)
  }, [])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    // Defer so the panel has painted before we move focus into it.
    const raf = requestAnimationFrame(() => {
      const [first] = focusables()
      ;(first ?? panelRef.current)?.focus()
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose, dismissable, focusables])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: #1A1D23 at 40%, no blur. */}
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40"
        onClick={dismissable ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full animate-slide-up rounded-modal bg-surface shadow-modal',
          'max-h-[calc(100vh-32px)] overflow-y-auto',
          sizes[size]
        )}
      >
        <div className="px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <h2
            id={titleId}
            className="font-display text-heading-sm font-medium text-ink"
          >
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-2 text-body-sm text-ink-secondary">
              {description}
            </p>
          )}
        </div>

        {children && <div className="px-6 pb-2 sm:px-8">{children}</div>}

        {footer && (
          /* Primary action right, cancel/secondary left — consistent app-wide. */
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
}

/** Delete/revoke confirmation — destructive actions always pair with this step. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      dismissable={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={() => void onConfirm()}
            loading={loading}
            className={destructive ? 'border-error' : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
