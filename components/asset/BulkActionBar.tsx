'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { MoveIcon, ShareIcon, TagIcon, TrashIcon } from '@/components/ui/Icon'
import { can, canActOn } from '@/lib/permissions'
import {
  addTagToAssetsAction,
  deleteAssetsAction,
  moveAssetsAction,
} from '@/app/(dashboard)/library/actions'
import { addAssetsToCollectionAction } from '@/app/(dashboard)/collections/actions'
import { TagAutocomplete } from './TagAutocomplete'
import type { AssetWithRelations } from '@/lib/queries'
import type { Folder, Tag, UserRole } from '@/types/database'

/**
 * Bulk action bar for a multi-select in the grid/list views (TICKET-008):
 * move, tag, add to collection, share, delete.
 *
 * Actions the role can't perform on the selection are hidden rather than shown
 * disabled-and-failing.
 */
export function BulkActionBar({
  selected,
  assets,
  folders,
  tags,
  collections,
  role,
  currentUserId,
  onClear,
  onShare,
}: {
  selected: Set<string>
  assets: AssetWithRelations[]
  folders: Folder[]
  tags: Tag[]
  collections: { id: string; name: string }[]
  role: UserRole
  currentUserId: string
  onClear: () => void
  onShare?: () => void
}) {
  const [moveOpen, setMoveOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [targetFolder, setTargetFolder] = useState<string>('__root__')
  const [targetCollection, setTargetCollection] = useState<string>('')
  const [tagValue, setTagValue] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  const ids = Array.from(selected)
  const selectedAssets = assets.filter((a) => selected.has(a.id))

  // Only offer an action if it applies to at least one selected asset.
  const canMoveAny = selectedAssets.some((a) =>
    canActOn(role, 'update', a.uploaded_by, currentUserId)
  )
  const canTagAny = selectedAssets.some((a) =>
    canActOn(role, 'tag', a.uploaded_by, currentUserId)
  )
  const canDeleteAny = selectedAssets.some((a) =>
    canActOn(role, 'delete', a.uploaded_by, currentUserId)
  )

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        toast.error(result.error ?? 'Something went wrong on our end — please try again.')
        return
      }
      // A partial success returns ok:true with an explanatory message.
      if (result.error) toast.warning(result.error)
      else toast.success(successMessage)

      setMoveOpen(false)
      setTagOpen(false)
      setCollectionOpen(false)
      setDeleteOpen(false)
      onClear()
      router.refresh()
    })
  }

  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card"
      >
        <span className="font-mono text-meta text-ink-secondary">
          {selected.size} selected
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {canMoveAny && (
            <Button variant="secondary" size="compact" onClick={() => setMoveOpen(true)}>
              <MoveIcon size={16} />
              Move
            </Button>
          )}
          {canTagAny && (
            <Button variant="secondary" size="compact" onClick={() => setTagOpen(true)}>
              <TagIcon size={16} />
              Tag
            </Button>
          )}
          {can(role, 'collection:manage') && collections.length > 0 && (
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setCollectionOpen(true)}
            >
              Add to collection
            </Button>
          )}
          {can(role, 'share_link:create') && onShare && selected.size === 1 && (
            <Button variant="secondary" size="compact" onClick={onShare}>
              <ShareIcon size={16} />
              Share
            </Button>
          )}
          {canDeleteAny && (
            <Button variant="destructive" size="compact" onClick={() => setDeleteOpen(true)}>
              <TrashIcon size={16} />
              Delete
            </Button>
          )}
        </div>

        <Button variant="ghost" size="compact" onClick={onClear} className="ml-auto">
          Clear selection
        </Button>
      </div>

      {/* Move */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move assets"
        description={`Choose a destination folder for ${selected.size} ${
          selected.size === 1 ? 'asset' : 'assets'
        }.`}
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () =>
                    moveAssetsAction({
                      assetIds: ids,
                      folderId: targetFolder === '__root__' ? null : targetFolder,
                    }),
                  'Assets moved.'
                )
              }
            >
              Move
            </Button>
          </>
        }
      >
        <Select
          label="Destination"
          value={targetFolder}
          onChange={(e) => setTargetFolder(e.target.value)}
        >
          <option value="__root__">Unfiled (no folder)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </Modal>

      {/* Bulk tag */}
      <Modal
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        title="Tag assets"
        description={`Add a tag to ${selected.size} ${
          selected.size === 1 ? 'asset' : 'assets'
        }. Existing tags are reused.`}
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTagOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={tagValue.trim().length === 0}
              onClick={() =>
                run(
                  () => addTagToAssetsAction({ assetIds: ids, tagName: tagValue.trim() }),
                  'Tag added.'
                )
              }
            >
              Add tag
            </Button>
          </>
        }
      >
        <TagAutocomplete
          tags={tags}
          value={tagValue}
          onChange={setTagValue}
          label="Tag"
          autoFocus
        />
      </Modal>

      {/* Add to collection */}
      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title="Add to collection"
        description="Assets stay in their current folder — collections are a separate grouping."
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCollectionOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={!targetCollection}
              onClick={() =>
                run(
                  () =>
                    addAssetsToCollectionAction({
                      collectionId: targetCollection,
                      assetIds: ids,
                    }),
                  'Added to collection.'
                )
              }
            >
              Add
            </Button>
          </>
        }
      >
        <Select
          label="Collection"
          value={targetCollection}
          onChange={(e) => setTargetCollection(e.target.value)}
        >
          <option value="">Choose a collection…</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => run(() => deleteAssetsAction(ids), 'Assets deleted.')}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'asset' : 'assets'}?`}
        description="They will be removed from the library. Version history is retained, so this can be reversed by an administrator."
        confirmLabel="Delete"
        loading={pending}
      />
    </>
  )
}
