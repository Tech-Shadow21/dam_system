'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError, FormSuccess } from '@/components/ui/FormError'
import { signUpAction, type ActionState } from '../actions'

const initialState: ActionState = {}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUpAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormError message={state.errors?.form} />
      <FormSuccess message={state.message} />

      <Input
        label="Organization name"
        name="organizationName"
        autoComplete="organization"
        placeholder="Northwind Brand Studio"
        required
        error={state.errors?.organizationName}
      />

      <Input
        label="Your full name"
        name="fullName"
        autoComplete="name"
        placeholder="Alex Moreau"
        required
        error={state.errors?.fullName}
      />

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
        autoComplete="new-password"
        required
        hint="At least 8 characters."
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
      Create organization
    </Button>
  )
}
