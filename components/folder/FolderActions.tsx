'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/ui/Icon'
import {
  createFolderAction,
  deleteFolderAction,
  renameFolderAction,
} from '@/app/(dashboard)/library/actions'
import type { Folder } from '@/types/database'

/**
 * Folder create/rename/delete controls (TICKET-006).
 *
 * Rendered only for roles holding folder:manage — the library page decides, so
 * a Contributor or Viewer never sees these controls at all.
 */
export function FolderActions({
  currentFolder,
  folders,
}: {
  currentFolder: Folder | null
  folders: Folder[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>(currentFolder?.id ?? '__root__')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; errors?: Record<string, string>; id?: string }>,
    onSuccess: (id?: string) => void
  ) {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }
      onSuccess(result.id)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="compact"
          onClick={() => {
            setName('')
            setParentId(currentFolder?.id ?? '__root__')
            setCreateOpen(true)
          }}
        >
          <PlusIcon size={16} />
          New folder
        </Button>

        {currentFolder && (
          <>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => {
                setName(currentFolder.name)
                setRenameOpen(true)
              }}
            >
              <PencilIcon size={16} />
              Rename
            </Button>
            <Button
              variant="destructive"
              size="compact"
              onClick={() => setDeleteOpen(true)}
            >
              <TrashIcon size={16} />
              Delete folder
            </Button>
          </>
        )}
      </div>

      {/* Create */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New folder"
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () =>
                    createFolderAction({
                      name,
                      parentFolderId: parentId === '__root__' ? null : parentId,
                    }),
                  () => {
                    setCreateOpen(false)
                    toast.success('Folder created.')
                  }
                )
              }
            >
              Create folder
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <FormError message={formError} />
          <Input
            label="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            autoFocus
            placeholder="Q4 Campaign"
          />
          <Select
            label="Location"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            hint="Folders can be nested to any depth."
          >
            <option value="__root__">Library root</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Rename */}
      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename folder"
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                if (!currentFolder) return
                run(
                  () => renameFolderAction({ folderId: currentFolder.id, name }),
                  () => {
                    setRenameOpen(false)
                    toast.success('Folder renamed.')
                  }
                )
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <FormError message={formError} />
          <Input
            label="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            autoFocus
          />
        </div>
      </Modal>

      {/* Delete */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!currentFolder) return
          run(
            () => deleteFolderAction(currentFolder.id),
            () => {
              setDeleteOpen(false)
              toast.success('Folder deleted.')
              router.push(
                currentFolder.parent_folder_id
                  ? `/library/${currentFolder.parent_folder_id}`
                  : '/library'
              )
            }
          )
        }}
        title={`Delete "${currentFolder?.name ?? ''}"?`}
        // State plainly what happens to the contents — assets are unfiled, not
        // destroyed (ON DELETE SET NULL on assets.folder_id).
        description="Any subfolders are deleted too. Assets inside are not deleted — they become unfiled and stay in your library."
        confirmLabel="Delete folder"
        loading={pending}
      />
    </>
  )
}
