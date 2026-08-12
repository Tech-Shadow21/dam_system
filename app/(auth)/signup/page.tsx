import Link from 'next/link'
import type { Metadata } from 'next'
import { SignUpForm } from './SignUpForm'
import { hasSupabaseCredentials } from '@/lib/env'
import { SetupNotice } from '@/components/ui/SetupNotice'

export const metadata: Metadata = { title: 'Create your organization — Vaultra' }

export default function SignUpPage() {
  return (
    <div>
      <h1 className="font-display text-display font-medium text-ink">
        Create your archive
      </h1>
      <p className="mt-3 text-body-sm text-ink-secondary">
        Set up your organization. You&rsquo;ll be its Owner, and can invite your
        team next.
      </p>

      {!hasSupabaseCredentials() && <SetupNotice className="mt-6" />}

      <div className="mt-8">
        <SignUpForm />
      </div>

      <p className="mt-8 text-body-sm text-ink-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
