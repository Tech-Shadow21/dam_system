'use client'

import { useEffect, useRef, useState } from 'react'
import { cn, initials } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/permissions'
import { LogoutIcon } from '@/components/ui/Icon'
import { logoutAction } from '@/app/(auth)/actions'
import type { UserRole } from '@/types/database'

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string
  email: string
  role: UserRole
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape, and restore focus to the trigger.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const displayName = fullName?.trim() || email

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-3 rounded-control py-1 pl-1 pr-2 transition-colors',
          'hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-meta-sm font-medium text-white"
        >
          {initials(displayName)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-body-sm font-medium text-ink">
            {displayName}
          </span>
          <span className="block text-meta-sm text-ink-secondary">{ROLE_LABELS[role]}</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={cn('text-ink-secondary transition-transform', open && 'rotate-180')}
        >
          <path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-[240px] animate-slide-up overflow-hidden rounded-card border border-line bg-surface shadow-card"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-body-sm font-medium text-ink">{displayName}</p>
            <p className="truncate font-mono text-meta-sm text-ink-secondary">{email}</p>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-sm text-ink transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <LogoutIcon size={18} className="text-ink-secondary" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
