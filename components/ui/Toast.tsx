'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'

export type ToastTone = 'info' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  message: string
  tone: ToastTone
  /** Optional retry affordance — errors are never silently auto-retried
   *  (see 03-security-access.md error handling). */
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0
function nextId() {
  counter += 1
  return `toast-${counter}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId()
      setToasts((prev) => [...prev, { ...toast, id }])
      // Errors with a retry action persist until dismissed so the user doesn't
      // lose the retry affordance.
      const duration =
        toast.duration ?? (toast.action ? 0 : toast.tone === 'error' ? 6000 : 4000)
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        )
      }
      return id
    },
    [dismiss]
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach(clearTimeout)
      map.clear()
    }
  }, [])

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return useMemo(
    () => ({
      toast: ctx.push,
      dismiss: ctx.dismiss,
      success: (message: string) => ctx.push({ message, tone: 'success' }),
      error: (message: string, action?: Toast['action']) =>
        ctx.push({ message, tone: 'error', action }),
      info: (message: string) => ctx.push({ message, tone: 'info' }),
      warning: (message: string) => ctx.push({ message, tone: 'warning' }),
    }),
    [ctx]
  )
}

const toneStyles: Record<ToastTone, { border: string; icon: string; path: string }> = {
  info: { border: 'border-l-primary', icon: 'text-primary', path: 'M10 6v.01M10 9v5' },
  success: { border: 'border-l-success', icon: 'text-success', path: 'M6 10.5l2.5 2.5L14 7.5' },
  error: { border: 'border-l-error', icon: 'text-error', path: 'M10 6v5M10 14v.01' },
  warning: { border: 'border-l-warning', icon: 'text-warning-ink', path: 'M10 6v5M10 14v.01' },
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[calc(100vw-48px)] max-w-[380px] flex-col gap-3"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const tone = toneStyles[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-card border border-line',
              'border-l-4 bg-surface p-4 shadow-card',
              tone.border
            )}
          >
            <svg
              className={cn('mt-[2px] h-5 w-5 shrink-0', tone.icon)}
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
              <path
                d={tone.path}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm text-ink">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick()
                    onDismiss(t.id)
                  }}
                  className="mt-2 text-meta font-medium text-primary underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 shrink-0 rounded p-1 text-ink-secondary transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
