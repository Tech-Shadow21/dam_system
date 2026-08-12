'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import type { UserRole } from '@/types/database'

/**
 * Client wrapper holding the mobile drawer state. The sidebar is fixed at
 * tablet/desktop widths and becomes an overlay drawer below `lg`, which is what
 * makes the core flows usable at 768px (TICKET-020).
 */
export function AppShell({
  role,
  fullName,
  email,
  organizationName,
  children,
}: {
  role: UserRole
  fullName: string
  email: string
  organizationName: string
  children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  // Navigating should always dismiss the drawer.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar role={role} organizationName={organizationName} />
      </aside>

      {/* Mobile/tablet drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full animate-fade-in">
            <Sidebar
              role={role}
              organizationName={organizationName}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-sidebar">
        <Topbar
          fullName={fullName}
          email={email}
          role={role}
          onOpenSidebar={() => setDrawerOpen(true)}
        />
        {/* 32px outer padding per the layout spec, relaxed on small screens. */}
        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
