'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function SettingsNav({
  sections,
}: {
  sections: { href: string; label: string }[]
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Settings sections">
      <h2 className="mb-3 font-mono text-meta-sm uppercase tracking-wider text-ink-secondary">
        Settings
      </h2>
      <ul className="flex flex-col gap-1">
        {sections.map((section) => {
          const active = pathname === section.href
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center rounded-control px-3 py-2 text-body-sm transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  active
                    ? 'bg-accent-muted font-medium text-primary'
                    : 'text-ink-secondary hover:bg-primary/[0.04] hover:text-ink'
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-accent"
                  />
                )}
                {section.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
