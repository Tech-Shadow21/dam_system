'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { SearchIcon } from '@/components/ui/Icon'
import { UserMenu } from './UserMenu'
import type { UserRole } from '@/types/database'

/**
 * Top bar: global search front and centre (01-prd.md App Flow step 3) plus the
 * user menu. `onOpenSidebar` surfaces the drawer trigger below the lg breakpoint.
 */
export function Topbar({
  fullName,
  email,
  role,
  onOpenSidebar,
}: {
  fullName: string
  email: string
  role: UserRole
  onOpenSidebar: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-line bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="-ml-1 rounded-control p-2 text-ink-secondary transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <form onSubmit={onSubmit} role="search" className="flex-1">
        <label htmlFor="global-search" className="sr-only">
          Search assets
        </label>
        <div className="relative max-w-[520px]">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary"
          />
          <input
            id="global-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search filenames, tags, metadata…"
            className="h-10 w-full rounded-control border border-line bg-canvas pl-10 pr-3 text-body-sm text-ink outline-none transition-colors placeholder:text-ink-secondary focus:border-primary focus:bg-surface focus:shadow-focus"
          />
        </div>
      </form>

      <UserMenu fullName={fullName} email={email} role={role} />
    </header>
  )
}
