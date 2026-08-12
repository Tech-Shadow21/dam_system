'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { loginAction, type ActionState } from '../actions'

const initialState: ActionState = {}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(loginAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <FormError message={state.errors?.form} />

      <Input
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        required
        error={state.errors?.email}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors?.password}
      />

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="hero" loading={pending} className="w-full">
      Sign in
    </Button>
  )
}
