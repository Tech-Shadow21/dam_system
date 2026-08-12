'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { removeLogoAction, updateBrandingAction, uploadLogoAction } from '../actions'

/** Default Vaultra palette, used when an org hasn't set its own colors. */
const DEFAULT_PRIMARY = '#1B2A4A'
const DEFAULT_ACCENT = '#C9A24B'

export function BrandingForm({
  logoPreviewUrl,
  primaryColor,
  secondaryColor,
  organizationName,
}: {
  logoPreviewUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  organizationName: string
}) {
  const [primary, setPrimary] = useState(primaryColor ?? DEFAULT_PRIMARY)
  const [secondary, setSecondary] = useState(secondaryColor ?? DEFAULT_ACCENT)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [uploading, startUpload] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const toast = useToast()

  function saveColors() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = await updateBrandingAction({
        brandPrimaryColor: primary,
        brandSecondaryColor: secondary,
      })
      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }
      toast.success('Branding saved. New share portal visits use these colors.')
      router.refresh()
    })
  }

  function uploadLogo(file: File) {
    startUpload(async () => {
      const formData = new FormData()
      formData.append('logo', file)
      const result = await uploadLogoAction(formData)
      if (!result.ok) {
        toast.error(result.error ?? result.errors?.logo ?? 'Could not upload that logo.')
        return
      }
      toast.success('Logo updated.')
      router.refresh()
    })
  }

  function removeLogo() {
    startUpload(async () => {
      const result = await removeLogoAction()
      if (!result.ok) {
        toast.error(result.error ?? 'Could not remove the logo.')
        return
      }
      toast.success('Logo removed.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-canvas">
              {logoPreviewUrl ? (
                <Image
                  src={logoPreviewUrl}
                  alt={`${organizationName} logo`}
                  width={80}
                  height={80}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-mono text-meta-sm text-ink-secondary">none</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                loading={uploading}
              >
                {logoPreviewUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
              {logoPreviewUrl && (
                <Button variant="destructive" onClick={removeLogo} disabled={uploading}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <p className="text-meta text-ink-secondary">
            Resized to 512px and converted to WebP on upload. PNG or SVG with a
            transparent background works best on the portal.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadLogo(file)
              e.target.value = ''
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portal colors</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-6">
          <FormError message={formError} />

          <ColorField
            label="Primary color"
            value={primary}
            onChange={setPrimary}
            error={errors.brandPrimaryColor}
            hint="Used for the portal header and primary actions."
          />
          <ColorField
            label="Accent color"
            value={secondary}
            onChange={setSecondary}
            error={errors.brandSecondaryColor}
            hint="Used sparingly for highlights and links."
          />

          {/* Live preview so the effect is visible before saving. */}
          <div>
            <p className="mb-2 text-meta font-medium text-ink-secondary">Preview</p>
            <div
              className="overflow-hidden rounded-card border border-line"
              style={{ backgroundColor: primary }}
            >
              <div className="flex items-center justify-between gap-4 p-6">
                <div>
                  <p
                    className="font-display text-heading-sm font-medium"
                    style={{ color: '#FFFFFF' }}
                  >
                    {organizationName}
                  </p>
                  <p className="mt-1 text-meta" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Shared assets
                  </p>
                </div>
                <span
                  className="rounded-control px-4 py-2 text-button font-medium"
                  style={{ backgroundColor: secondary, color: primary }}
                >
                  Download
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveColors} loading={pending}>
              Save colors
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPrimary(DEFAULT_PRIMARY)
                setSecondary(DEFAULT_ACCENT)
              }}
              disabled={pending}
            >
              Reset to Vaultra defaults
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

/** Color picker paired with a hex input, per the ticket's acceptance criteria. */
function ColorField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
}) {
  return (
    <div className="flex items-end gap-3">
      <label className="shrink-0">
        <span className="sr-only">{label} picker</span>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-14 cursor-pointer rounded-control border border-line bg-surface p-1"
        />
      </label>
      <div className="flex-1">
        <Input
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          hint={hint}
          mono
          placeholder="#1B2A4A"
        />
      </div>
    </div>
  )
}
