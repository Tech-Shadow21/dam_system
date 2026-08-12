import Image from 'next/image'

/**
 * Branded portal chrome (TICKET-016).
 *
 * The external portal always renders in the organization's own brand colors,
 * falling back to the light Vaultra palette when unset
 * (04-frontend-specification.md). Colors arrive as inline CSS variables because
 * they're per-organization runtime values, not build-time theme tokens.
 */
export function BrandedPortalShell({
  organizationName,
  logoUrl,
  primaryColor,
  accentColor,
  children,
  footerNote,
}: {
  organizationName: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  children: React.ReactNode
  footerNote?: string
}) {
  const primary = sanitizeHex(primaryColor) ?? '#1B2A4A'
  const accent = sanitizeHex(accentColor) ?? '#C9A24B'

  return (
    <div
      className="flex min-h-screen flex-col bg-canvas"
      style={
        {
          '--portal-primary': primary,
          '--portal-accent': accent,
        } as React.CSSProperties
      }
    >
      <a
        href="#portal-content"
        className="sr-only-focusable absolute left-4 top-4 z-50 rounded-control bg-surface px-4 py-2 text-body-sm font-medium text-ink shadow-card"
      >
        Skip to shared assets
      </a>

      <header style={{ backgroundColor: primary }}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-4 py-6 sm:px-8">
          {logoUrl ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-white/10">
              <Image
                src={logoUrl}
                alt={`${organizationName} logo`}
                width={48}
                height={48}
                className="h-full w-full object-contain"
              />
            </span>
          ) : null}

          <div className="min-w-0">
            <p className="font-display text-heading-sm font-medium text-white">
              {organizationName}
            </p>
            <p className="mt-0.5 text-meta" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Shared assets
            </p>
          </div>
        </div>
      </header>

      <main
        id="portal-content"
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-8 sm:py-12"
      >
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-8">
          <p className="text-meta text-ink-secondary">
            {footerNote ?? `Shared securely by ${organizationName}.`}
          </p>
          <p className="font-mono text-meta-sm text-ink-secondary">
            Powered by Vaultra
          </p>
        </div>
      </footer>
    </div>
  )
}

/**
 * Guards against a malformed value reaching an inline style. The DB has a CHECK
 * constraint on these columns, but this is the boundary where an org-controlled
 * value is injected into markup served to third parties.
 */
function sanitizeHex(value: string | null): string | null {
  if (!value) return null
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null
}
