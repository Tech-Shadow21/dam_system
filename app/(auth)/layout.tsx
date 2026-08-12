import Link from 'next/link'

/**
 * Auth shell. Fraunces carries the voice on the login screen per
 * 04-frontend-specification.md; the navy panel establishes the "fortified
 * archive" feel before the user is even signed in.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — hidden on small screens where vertical space matters. */}
      <aside className="relative hidden bg-primary lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:p-12">
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <VaultMark />
          <span className="font-display text-heading-sm font-semibold text-white">
            Vaultra
          </span>
        </Link>

        <div className="max-w-[420px]">
          <h2 className="font-display text-display font-medium leading-tight text-white">
            The single source of truth for your brand.
          </h2>
          <p className="mt-6 text-body text-white/70">
            Every approved asset in one place — found in seconds, shared with
            total control over who sees what, and for how long.
          </p>
        </div>

        <p className="font-mono text-meta-sm text-white/40">
          Enterprise-grade control, without enterprise complexity.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          {/* Wordmark for narrow screens, where the brand panel is hidden. */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-3 lg:hidden"
            aria-label="Vaultra home"
          >
            <VaultMark tone="dark" />
            <span className="font-display text-heading-sm font-semibold text-ink">
              Vaultra
            </span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Vault-door mark: concentric ring and spokes, echoing the archive metaphor. */
function VaultMark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const stroke = tone === 'light' ? '#C9A24B' : '#1B2A4A'
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7"
        stroke={stroke}
        strokeWidth="1.75"
      />
      <circle cx="16" cy="16" r="7.5" stroke={stroke} strokeWidth="1.75" />
      <circle cx="16" cy="16" r="2.25" fill={stroke} />
      <path
        d="M16 5.5v3M16 23.5v3M5.5 16h3M23.5 16h3"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}
