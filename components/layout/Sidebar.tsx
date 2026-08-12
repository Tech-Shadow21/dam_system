'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { UserRole } from '@/types/database'
import {
  CollectionIcon,
  HomeIcon,
  LibraryIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
} from '@/components/ui/Icon'

/**
 * Fixed 240px navy sidebar per 04-frontend-specification.md: light text on
 * #1B2A4A, brass accent marking the active item. Items the user's role can't
 * reach are not rendered at all.
 */

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Rendered only when the role holds this permission. */
  requires?: Parameters<typeof can>[1]
  /** Match nested routes, not just the exact path. */
  matchPrefix?: boolean
}

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/library', label: 'Library', icon: LibraryIcon, matchPrefix: true },
  { href: '/collections', label: 'Collections', icon: CollectionIcon, matchPrefix: true },
  { href: '/search', label: 'Search', icon: SearchIcon },
  {
    href: '/shares',
    label: 'Shares',
    icon: ShareIcon,
    requires: 'share_link:create',
    matchPrefix: true,
  },
]

const SETTINGS_NAV: NavItem[] = [
  { href: '/settings/organization', label: 'Organization', icon: SettingsIcon, requires: 'org:update' },
  { href: '/settings/branding', label: 'Branding', icon: SettingsIcon, requires: 'org:update' },
  { href: '/settings/metadata', label: 'Metadata fields', icon: SettingsIcon, requires: 'metadata_field:manage' },
  { href: '/settings/users', label: 'Users', icon: SettingsIcon, requires: 'user:manage' },
]

export function Sidebar({
  role,
  organizationName,
  onNavigate,
}: {
  role: UserRole
  organizationName: string
  /** Closes the mobile drawer after a navigation. */
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  const isActive = (item: NavItem) =>
    item.matchPrefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href

  const visibleSettings = SETTINGS_NAV.filter((i) => !i.requires || can(role, i.requires))

  return (
    <div className="flex h-full w-sidebar flex-col bg-primary">
      {/* Wordmark */}
      <div className="flex h-16 items-center gap-3 px-6">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="29" height="29" rx="7" stroke="#C9A24B" strokeWidth="2" />
          <circle cx="16" cy="16" r="7.5" stroke="#C9A24B" strokeWidth="2" />
          <circle cx="16" cy="16" r="2.25" fill="#C9A24B" />
          <path
            d="M16 5.5v3M16 23.5v3M5.5 16h3M23.5 16h3"
            stroke="#C9A24B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-display text-heading-sm font-semibold text-white">Vaultra</span>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="flex flex-col gap-1">
          {NAV.filter((i) => !i.requires || can(role, i.requires)).map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>

        {visibleSettings.length > 0 && (
          <>
            <h2 className="px-3 pb-2 pt-6 font-mono text-meta-sm uppercase tracking-wider text-white/40">
              Settings
            </h2>
            <ul className="flex flex-col gap-1">
              {visibleSettings.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(item)} onNavigate={onNavigate} hideIcon />
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Org footer */}
      <div className="border-t border-white/10 px-6 py-4">
        <p className="font-mono text-meta-sm uppercase tracking-wider text-white/40">
          Organization
        </p>
        <p className="mt-1 truncate text-body-sm font-medium text-white/90" title={organizationName}>
          {organizationName}
        </p>
      </div>
    </div>
  )
}

function NavLink({
  item,
  active,
  onNavigate,
  hideIcon = false,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
  hideIcon?: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-control px-3 py-2 text-body-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active
          ? 'bg-white/[0.07] font-medium text-accent'
          : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
      )}
    >
      {/* Brass rail marks the active item. */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-accent"
        />
      )}
      {!hideIcon && <Icon size={18} className={active ? 'text-accent' : undefined} />}
      <span className={cn('truncate', hideIcon && 'pl-[30px]')}>{item.label}</span>
    </Link>
  )
}
