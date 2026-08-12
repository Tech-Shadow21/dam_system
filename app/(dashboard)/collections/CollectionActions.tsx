'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/ui/Icon'
import {
  createCollectionAction,
  deleteCollectionAction,
  updateCollectionAction,
} from './actions'

/** Create/rename/delete collections (TICKET-014). */
export function CollectionActions({
  mode,
  collection,
}: {
  mode: 'create' | 'edit'
  collection?: { id: string; name: string; description: string | null }
}) {
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(collection?.name ?? '')
  const [description, setDescription] = useState(collection?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function submit() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCollectionAction({ name, description })
          : await updateCollectionAction({
              collectionId: collection!.id,
              name,
              description,
            })

      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }

      setOpen(false)
      toast.success(mode === 'create' ? 'Collection created.' : 'Collection updated.')
      if (mode === 'create') {
        setName('')
        setDescription('')
      }
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteCollectionAction(collection!.id)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete this collection.')
        return
      }
      setDeleteOpen(false)
      toast.success('Collection deleted.')
      router.push('/collections')
      router.refresh()
    })
  }

  return (
    <>
      {mode === 'create' ? (
        <Button variant="hero" onClick={() => setOpen(true)}>
          <PlusIcon size={18} />
          New collection
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="compact"
            onClick={() => {
              setName(collection?.name ?? '')
              setDescription(collection?.description ?? '')
              setOpen(true)
            }}
          >
            <PencilIcon size={14} />
            Edit
          </Button>
          <Button variant="ghost" size="compact" onClick={() => setDeleteOpen(true)}>
            <TrashIcon size={14} />
            Delete
          </Button>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'create' ? 'New collection' : 'Edit collection'}
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} loading={pending}>
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <FormError message={formError} />
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            autoFocus
            placeholder="Spring Launch Kit"
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            hint="Optional. What this collection is for."
          />
        </div>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title={`Delete "${collection?.name ?? ''}"?`}
        description="The collection is removed. The assets in it are not deleted — they stay in their folders."
        confirmLabel="Delete collection"
        loading={pending}
      />
    </>
  )
}
