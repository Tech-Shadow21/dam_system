'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { updateOrganizationAction } from '../actions'

export function OrganizationForm({ name: initialName }: { name: string }) {
  const [name, setName] = useState(initialName)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function save() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = await updateOrganizationAction({ name })
      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }
      toast.success('Organization updated.')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        <FormError message={formError} />
        <Input
          label="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          hint="Shown in the sidebar and on the external share portal."
        />
        <div>
          <Button onClick={save} loading={pending} disabled={name.trim() === initialName}>
            Save changes
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
