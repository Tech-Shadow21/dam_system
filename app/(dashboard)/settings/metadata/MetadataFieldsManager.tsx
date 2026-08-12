'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormError } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/ui/Icon'
import {
  createMetadataFieldAction,
  deleteMetadataFieldAction,
  updateMetadataFieldAction,
} from '../actions'
import type { MetadataField, MetadataFieldType } from '@/types/database'

const TYPE_LABELS: Record<MetadataFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Select (choose one)',
}

/** Create/edit/delete custom metadata field definitions (TICKET-011). */
export function MetadataFieldsManager({ fields }: { fields: MetadataField[] }) {
  const [editing, setEditing] = useState<MetadataField | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<MetadataField | null>(null)

  const [label, setLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState<MetadataFieldType>('text')
  const [optionsText, setOptionsText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function openCreate() {
    setLabel('')
    setFieldKey('')
    setFieldType('text')
    setOptionsText('')
    setErrors({})
    setFormError(null)
    setCreating(true)
  }

  function openEdit(field: MetadataField) {
    setLabel(field.label)
    setFieldKey(field.field_key)
    setFieldType(field.field_type)
    setOptionsText(
      Array.isArray(field.options) ? (field.options as string[]).join('\n') : ''
    )
    setErrors({})
    setFormError(null)
    setEditing(field)
  }

  /** Suggests a snake_case key from the label, since the key is immutable later. */
  function onLabelChange(next: string) {
    setLabel(next)
    if (creating) {
      setFieldKey(
        next
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 60)
      )
    }
  }

  const options = optionsText
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)

  function submit() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = creating
        ? await createMetadataFieldAction({ fieldKey, label, fieldType, options })
        : await updateMetadataFieldAction({
            fieldId: editing!.id,
            label,
            fieldType,
            options,
          })

      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }

      toast.success(creating ? 'Field created.' : 'Field updated.')
      setCreating(false)
      setEditing(null)
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteMetadataFieldAction(deleting!.id)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete that field.')
        return
      }
      toast.success('Field deleted.')
      setDeleting(null)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="hero" onClick={openCreate}>
          <PlusIcon size={18} />
          New field
        </Button>
      </div>

      {fields.length === 0 ? (
        <EmptyState
          title="No custom fields yet"
          description="Add fields like Campaign, Usage Rights or Photographer, and they'll appear on every asset's metadata panel."
          action={
            <Button variant="hero" onClick={openCreate}>
              <PlusIcon size={18} />
              New field
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((field) => (
            <li key={field.id}>
              <Card>
                <CardBody className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-ink">{field.label}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-meta-sm text-ink-secondary">
                      <span>{field.field_key}</span>
                      <Badge tone="neutral">{TYPE_LABELS[field.field_type]}</Badge>
                      {field.field_type === 'select' && Array.isArray(field.options) && (
                        <span>{(field.options as string[]).length} options</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="compact" onClick={() => openEdit(field)}>
                      <PencilIcon size={14} />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="compact"
                      className="text-error hover:bg-error/10"
                      onClick={() => setDeleting(field)}
                    >
                      <TrashIcon size={14} />
                      Delete
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        title={creating ? 'New metadata field' : 'Edit metadata field'}
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} loading={pending}>
              {creating ? 'Create field' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <FormError message={formError} />

          <Input
            label="Label"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            error={errors.label}
            required
            autoFocus
            placeholder="Usage Rights"
            hint="Shown to users on the asset metadata panel."
          />

          <Input
            label="Field key"
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value)}
            error={errors.fieldKey}
            required
            mono
            // Immutable after creation: it's the jsonb key already stored on
            // every asset, so changing it would orphan existing values.
            disabled={!creating}
            hint={
              creating
                ? 'Lowercase letters, numbers and underscores. This cannot be changed later.'
                : 'The key cannot be changed once assets have values stored against it.'
            }
          />

          <Select
            label="Type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as MetadataFieldType)}
          >
            {(Object.keys(TYPE_LABELS) as MetadataFieldType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </Select>

          {fieldType === 'select' && (
            <Textarea
              label="Options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              error={errors.options}
              hint="One option per line."
              placeholder={'Unrestricted\nInternal only\nDo not use'}
            />
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={`Delete "${deleting?.label ?? ''}"?`}
        description="The field stops appearing on assets. Values already stored on individual assets are left untouched in the database, so re-creating the field with the same key restores them."
        confirmLabel="Delete field"
        loading={pending}
      />
    </div>
  )
}
