'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Checkbox, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { DownloadIcon, PencilIcon, ShareIcon, TrashIcon, VersionIcon } from '@/components/ui/Icon'
import { UploadDropzone } from '@/components/asset/UploadDropzone'
import { ShareLinkModal } from '@/components/share/ShareLinkModal'
import { deleteAssetsAction, updateAssetAction } from '@/app/(dashboard)/library/actions'
import { setAssetCollectionsAction } from '@/app/(dashboard)/collections/actions'
import type { UserRole } from '@/types/database'

/**
 * Detail-view action bar (TICKET-009): download, share, rename, replace file
 * (new version), collections, delete. Controls are omitted entirely when the
 * role can't use them.
 */
export function AssetActions({
  assetId,
  filename,
  canEdit,
  canDelete,
  role,
  uploadedBy,
  currentUserId,
  collections,
  assetCollectionIds,
  folderId,
}: {
  assetId: string
  filename: string
  canEdit: boolean
  canDelete: boolean
  role: UserRole
  uploadedBy: string | null
  currentUserId: string
  collections: { id: string; name: string }[]
  assetCollectionIds: string[]
  folderId: string | null
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(filename)
  const [selectedCollections, setSelectedCollections] = useState<string[]>(assetCollectionIds)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  // Contributors may share only their own assets; anyone with manage_any can
  // share any asset in the org.
  const canShare =
    can(role, 'share_link:manage_any') ||
    (can(role, 'share_link:create') && uploadedBy === currentUserId)

  function rename() {
    setError(null)
    startTransition(async () => {
      const result = await updateAssetAction({ assetId, filename: name })
      if (!result.ok) {
        setError(result.error ?? result.errors?.filename ?? 'Could not rename.')
        return
      }
      setRenameOpen(false)
      toast.success('Asset renamed.')
      router.refresh()
    })
  }

  function saveCollections() {
    startTransition(async () => {
      const result = await setAssetCollectionsAction({
        assetId,
        collectionIds: selectedCollections,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not update collections.')
        return
      }
      setCollectionsOpen(false)
      toast.success('Collections updated.')
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteAssetsAction([assetId])
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete this asset.')
        return
      }
      toast.success('Asset deleted.')
      router.push(folderId ? `/library/${folderId}` : '/library')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* A plain link, so the browser handles the download natively. */}
      <a
        href={`/api/assets/${assetId}?download=1`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 font-sans text-button font-medium text-white transition-colors hover:bg-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <DownloadIcon size={18} />
        Download
      </a>

      {canShare && (
        <Button variant="secondary" onClick={() => setShareOpen(true)}>
          <ShareIcon size={16} />
          Share
        </Button>
      )}

      {canEdit && (
        <>
          <Button
            variant="secondary"
            onClick={() => {
              setName(filename)
              setRenameOpen(true)
            }}
          >
            <PencilIcon size={16} />
            Rename
          </Button>
          <Button variant="secondary" onClick={() => setReplaceOpen(true)}>
            <VersionIcon size={16} />
            Replace file
          </Button>
        </>
      )}

      {can(role, 'collection:manage') && collections.length > 0 && (
        <Button variant="secondary" onClick={() => setCollectionsOpen(true)}>
          Collections
        </Button>
      )}

      {canDelete && (
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <TrashIcon size={16} />
          Delete
        </Button>
      )}

      {/* Rename */}
      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename asset"
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={rename} loading={pending}>
              Save
            </Button>
          </>
        }
      >
        <Input
          label="Filename"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error ?? undefined}
          required
          autoFocus
        />
      </Modal>

      {/* Replace file → new version */}
      <Modal
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title="Replace file"
        description="The current file becomes a previous version and can be restored at any time."
      >
        <UploadDropzone
          folderId={folderId}
          replaceAssetId={assetId}
          compact
          onComplete={() => {
            setReplaceOpen(false)
            router.refresh()
          }}
        />
      </Modal>

      {/* Collections */}
      <Modal
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        title="Collections"
        description="Collections group assets without moving them out of their folder."
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCollectionsOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={saveCollections} loading={pending}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {collections.map((collection) => (
            <Checkbox
              key={collection.id}
              checked={selectedCollections.includes(collection.id)}
              onChange={(e) =>
                setSelectedCollections((prev) =>
                  e.target.checked
                    ? [...prev, collection.id]
                    : prev.filter((id) => id !== collection.id)
                )
              }
              label={collection.name}
            />
          ))}
        </div>
      </Modal>

      <ShareLinkModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        targetType="asset"
        targetId={assetId}
        targetLabel={filename}
      />

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this asset?"
        description="It will be removed from the library. Version history is retained, so an administrator can reverse this."
        confirmLabel="Delete asset"
        loading={pending}
      />
    </div>
  )
}
