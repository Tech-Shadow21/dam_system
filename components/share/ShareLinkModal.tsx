'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Checkbox, Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { LockIcon } from '@/components/ui/Icon'
import { createShareLinkAction } from '@/app/(dashboard)/shares/actions'

/**
 * "Create Share Link" flow (TICKET-015): required expiration, optional password,
 * optional download permission, then the generated link to copy.
 */
export function ShareLinkModal({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean
  onClose: () => void
  targetType: 'asset' | 'folder' | 'collection'
  targetId: string
  targetLabel: string
}) {
  // Default to two weeks out — an expiry is required, so a sensible prefill
  // beats an empty date field.
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [allowDownload, setAllowDownload] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const toast = useToast()

  function reset() {
    setCreatedUrl(null)
    setErrors({})
    setFormError(null)
    setPassword('')
    setUsePassword(false)
    setCopied(false)
  }

  function submit() {
    setErrors({})
    setFormError(null)

    startTransition(async () => {
      const result = await createShareLinkAction({
        targetType,
        targetId,
        // Expire at end of the chosen day, so "expires today" stays usable today.
        expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
        password: usePassword ? password : undefined,
        allowDownload,
      })

      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }
      setCreatedUrl(result.url ?? null)
      toast.success('Share link created.')
    })
  }

  async function copy() {
    if (!createdUrl) return
    try {
      await navigator.clipboard.writeText(createdUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the link and copy manually.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={createdUrl ? 'Share link ready' : 'Create share link'}
      description={
        createdUrl
          ? 'Anyone with this link can view the shared content until it expires.'
          : `Sharing ${targetType}: ${targetLabel}`
      }
      dismissable={!pending}
      footer={
        createdUrl ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Done
            </Button>
            <Button variant="hero" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="hero" onClick={submit} loading={pending}>
              Create link
            </Button>
          </>
        )
      }
    >
      {createdUrl ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-control border border-line bg-canvas p-3">
            <p className="break-all font-mono text-meta text-ink">{createdUrl}</p>
          </div>
          <ul className="flex flex-col gap-1 text-meta text-ink-secondary">
            <li>Expires {new Date(`${expiresAt}T23:59:59`).toLocaleDateString()}</li>
            <li>{allowDownload ? 'Downloads allowed' : 'Viewing only — downloads blocked'}</li>
            {usePassword && <li>Password protected</li>}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <FormError message={formError} />

          <Input
            label="Expires on"
            type="date"
            required
            value={expiresAt}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setExpiresAt(e.target.value)}
            error={errors.expiresAt}
            hint="Every link must expire — there are no permanent public links."
          />

          <div className="flex flex-col gap-3">
            <Checkbox
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              label="Allow downloads"
            />
            <Checkbox
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              label={
                <span className="inline-flex items-center gap-2">
                  <LockIcon size={14} className="text-ink-secondary" />
                  Require a password
                </span>
              }
            />
          </div>

          {usePassword && (
            <Input
              label="Password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint="At least 6 characters. Share it with recipients separately from the link."
              autoComplete="off"
            />
          )}
        </div>
      )}
    </Modal>
  )
}
