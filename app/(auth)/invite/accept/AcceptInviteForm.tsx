'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { acceptInviteAction, type ActionState } from '../../actions'

const initialState: ActionState = {}

export function AcceptInviteForm({ defaultFullName }: { defaultFullName: string }) {
  const [state, formAction] = useFormState(acceptInviteAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormError message={state.errors?.form} />

      <Input
        label="Your full name"
        name="fullName"
        autoComplete="name"
        defaultValue={defaultFullName}
        required
        error={state.errors?.fullName}
      />

      <Input
        label="Choose a password"
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
      Activate my account
    </Button>
  )
}
