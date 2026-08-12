import Link from 'next/link'
import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'
import { hasSupabaseCredentials } from '@/lib/env'
import { SetupNotice } from '@/components/ui/SetupNotice'

export const metadata: Metadata = { title: 'Sign in — Vaultra' }

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; signedOut?: string }
}) {
  return (
    <div>
      <h1 className="font-display text-display font-medium text-ink">Welcome back</h1>
      <p className="mt-3 text-body-sm text-ink-secondary">
        Sign in to your organization&rsquo;s archive.
      </p>

      {!hasSupabaseCredentials() && <SetupNotice className="mt-6" />}

      <div className="mt-8">
        <LoginForm next={searchParams.next} />
      </div>

      <p className="mt-8 text-body-sm text-ink-secondary">
        Don&rsquo;t have an organization yet?{' '}
        <Link
          href="/signup"
          className="font-medium text-primary underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent"
        >
          Create one
        </Link>
      </p>
      <p className="mt-3 text-meta-sm text-ink-secondary">
        Team members join by invitation from an administrator.
      </p>
    </div>
  )
}
