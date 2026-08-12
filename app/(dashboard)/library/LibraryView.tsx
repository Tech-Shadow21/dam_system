'use client'

import { useState } from 'react'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeading } from '@/components/ui/PageHeader'
import { LibraryIcon, ShareIcon, UploadIcon } from '@/components/ui/Icon'
import { AssetBrowser } from '@/components/asset/AssetBrowser'
import { UploadDropzone } from '@/components/asset/UploadDropzone'
import { FolderCard } from '@/components/folder/FolderCard'
import { ShareLinkModal } from '@/components/share/ShareLinkModal'
import type { AssetWithRelations } from '@/lib/queries'
import type { Folder, Tag, UserRole } from '@/types/database'

/**
 * Folder browse view: subfolders, an upload target, then the asset grid/list.
 *
 * The dropzone is collapsed by default so a populated folder leads with its
 * content, but the whole view still accepts drops (TICKET-007: "drag files onto
 * the library view").
 */
export function LibraryView({
  folder,
  childFolders,
  assets,
  folders,
  tags,
  collections,
  folderCounts,
  role,
  currentUserId,
}: {
  folder: Folder | null
  childFolders: Folder[]
  assets: AssetWithRelations[]
  folders: Folder[]
  tags: Tag[]
  collections: { id: string; name: string }[]
  folderCounts: Record<string, number>
  role: UserRole
  currentUserId: string
}) {
  const canUpload = can(role, 'asset:create')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {canUpload && (
          <Button variant="hero" onClick={() => setUploadOpen((v) => !v)}>
            <UploadIcon size={18} />
            {uploadOpen ? 'Hide upload' : 'Upload'}
          </Button>
        )}
        {folder && can(role, 'share_link:manage_any') && (
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            <ShareIcon size={16} />
            Share this folder
          </Button>
        )}
      </div>

      {canUpload && (uploadOpen || assets.length === 0) && (
        <div className="mb-8">
          <UploadDropzone
            folderId={folder?.id ?? null}
            compact={assets.length > 0}
            onComplete={() => setUploadOpen(false)}
          />
        </div>
      )}

      {childFolders.length > 0 && (
        <section className="mb-8">
          <SectionHeading>Folders</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {childFolders.map((child) => (
              <FolderCard
                key={child.id}
                folder={child}
                assetCount={folderCounts[child.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        {childFolders.length > 0 && <SectionHeading>Assets</SectionHeading>}
        <AssetBrowser
          assets={assets}
          folders={folders}
          tags={tags}
          collections={collections}
          role={role}
          currentUserId={currentUserId}
          emptyState={
            <EmptyState
              icon={<LibraryIcon size={22} />}
              title={
                childFolders.length > 0
                  ? 'No assets directly in this folder'
                  : folder
                    ? 'This folder is empty'
                    : 'No unfiled assets'
              }
              description={
                canUpload
                  ? 'Drag files here or use the Upload button to add assets. You can tag and organize them afterwards.'
                  : 'Nothing has been added here yet.'
              }
            />
          }
        />
      </section>

      {folder && (
        <ShareLinkModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          targetType="folder"
          targetId={folder.id}
          targetLabel={folder.name}
        />
      )}
    </div>
  )
}
