import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

/**
 * Typography per 04-frontend-specification.md:
 * Fraunces (variable serif) for display/headings, IBM Plex Sans for body/UI,
 * IBM Plex Mono for anything that reads as data (file sizes, tokens, versions).
 */
// Loaded as a true variable font (no explicit `weight`) so the 500–600 range in
// the spec is available continuously; `axes` is only valid in this mode.
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK'],
  variable: '--font-fraunces',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'Vaultra — Digital Asset Management',
  description:
    'The trusted single source of truth for your organization’s digital assets.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen bg-canvas font-sans text-body-sm text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
