'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LockIcon } from '@/components/ui/Icon'
import { verifySharePasswordAction, type SharePasswordState } from './actions'

const initialState: SharePasswordState = {}

/**
 * Password gate for a protected link. The cooldown message after repeated
 * failures comes from the server, which owns the attempt counter.
 */
export function SharePasswordForm({
  token,
  organizationName,
}: {
  token: string
  organizationName: string
}) {
  const [state, formAction] = useFormState(verifySharePasswordAction, initialState)

  return (
    <div className="mx-auto max-w-[420px] rounded-card border border-line bg-surface p-6 sm:p-8">
      <div
        aria-hidden="true"
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-canvas"
        style={{ color: 'var(--portal-primary)' }}
      >
        <LockIcon size={22} />
      </div>

      <h1 className="font-display text-heading font-medium text-ink">
        This link is password protected
      </h1>
      <p className="mt-3 text-body-sm text-ink-secondary">
        Enter the password {organizationName} shared with you.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-6" noValidate>
        <input type="hidden" name="token" value={token} />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="off"
          autoFocus
          required
          error={state.error}
          hint={
            state.cooldownSeconds
              ? `Try again in about ${state.cooldownSeconds} seconds.`
              : undefined
          }
        />

        <SubmitButton disabled={Boolean(state.cooldownSeconds)} />
      </form>
    </div>
  )
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      // Inline styles because the portal renders in the organization's own brand
      // colors, which are runtime values rather than theme tokens.
      style={{ backgroundColor: 'var(--portal-primary)', color: '#FFFFFF' }}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-control font-sans text-button font-medium transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
    >
      {pending ? 'Checking…' : 'View shared assets'}
    </button>
  )
}
