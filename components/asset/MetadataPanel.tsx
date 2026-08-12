'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { updateAssetAction } from '@/app/(dashboard)/library/actions'
import type { Json, MetadataField } from '@/types/database'

/**
 * Custom metadata editor on the asset detail view (TICKET-011).
 *
 * Field definitions come from the org's metadata_fields; each renders the input
 * appropriate to its type, so a date field gets a date picker and a select field
 * a constrained dropdown.
 */
export function MetadataPanel({
  assetId,
  fields,
  values,
  editable,
}: {
  assetId: string
  fields: MetadataField[]
  values: Json
  editable: boolean
}) {
  const initial = normalize(values)
  const [draft, setDraft] = useState<Record<string, string>>(initial)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  const dirty = fields.some((f) => (draft[f.field_key] ?? '') !== (initial[f.field_key] ?? ''))

  function save() {
    startTransition(async () => {
      // Empty values are stored as null rather than "", so a cleared field reads
      // as absent instead of as an empty string.
      const metadata: Record<string, string | number | null> = {}
      for (const field of fields) {
        const raw = (draft[field.field_key] ?? '').trim()
        if (raw.length === 0) {
          metadata[field.field_key] = null
        } else if (field.field_type === 'number') {
          const n = Number(raw)
          metadata[field.field_key] = Number.isFinite(n) ? n : raw
        } else {
          metadata[field.field_key] = raw
        }
      }

      const result = await updateAssetAction({ assetId, metadata })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save metadata.')
        return
      }
      toast.success('Metadata saved.')
      router.refresh()
    })
  }

  if (fields.length === 0) {
    return (
      <EmptyState
        compact
        title="No custom fields yet"
        description="An admin or manager can define metadata fields in Settings, and they'll appear here for every asset."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const value = draft[field.field_key] ?? ''
        const onChange = (next: string) =>
          setDraft((prev) => ({ ...prev, [field.field_key]: next }))

        if (!editable) {
          return (
            <div key={field.id}>
              <p className="text-meta font-medium text-ink-secondary">{field.label}</p>
              <p className="mt-1 text-body-sm text-ink">
                {value || <span className="text-ink-secondary">—</span>}
              </p>
            </div>
          )
        }

        if (field.field_type === 'select') {
          const options = Array.isArray(field.options) ? (field.options as string[]) : []
          return (
            <Select
              key={field.id}
              label={field.label}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">—</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          )
        }

        return (
          <Input
            key={field.id}
            label={field.label}
            type={
              field.field_type === 'date'
                ? 'date'
                : field.field_type === 'number'
                  ? 'number'
                  : 'text'
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      })}

      {editable && (
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={pending} disabled={!dirty}>
            Save metadata
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(initial)} disabled={pending}>
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** jsonb values arrive as unknown; coerce to the string forms the inputs need. */
function normalize(values: Json): Record<string, string> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue
    out[key] = typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
  return out
}
