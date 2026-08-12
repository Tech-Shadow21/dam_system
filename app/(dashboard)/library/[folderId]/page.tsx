import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import {
  getAssetsInFolder,
  getChildFolders,
  getCollections,
  getFolder,
  getFolderAssetCounts,
  getFolderPath,
  getFolders,
  getTags,
} from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { FolderActions } from '@/components/folder/FolderActions'
import { FolderBreadcrumb } from '@/components/folder/FolderBreadcrumb'
import { FolderTree } from '@/components/folder/FolderTree'
import { LibraryView } from '../LibraryView'

export async function generateMetadata({
  params,
}: {
  params: { folderId: string }
}): Promise<Metadata> {
  const folder = await getFolder(params.folderId)
  return { title: folder ? `${folder.name} — Vaultra` : 'Folder — Vaultra' }
}

/** Folder browse view (TICKET-006 / TICKET-008). */
export default async function FolderPage({
  params,
}: {
  params: { folderId: string }
}) {
  const { profile } = await requireSession()

  const folder = await getFolder(params.folderId)
  // RLS means a folder in another organization reads as absent — a 404 is
  // correct and reveals nothing about whether it exists elsewhere.
  if (!folder) notFound()

  const [path, childFolders, assets, folders, tags, collections, counts] =
    await Promise.all([
      getFolderPath(folder.id),
      getChildFolders(folder.id),
      getAssetsInFolder(folder.id),
      getFolders(),
      getTags(),
      getCollections(),
      getFolderAssetCounts(),
    ])

  return (
    <div>
      <FolderBreadcrumb path={path} />

      <PageHeader
        title={folder.name}
        description={`${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}${
          childFolders.length > 0
            ? ` · ${childFolders.length} ${childFolders.length === 1 ? 'subfolder' : 'subfolders'}`
            : ''
        }`}
        actions={
          can(profile.role, 'folder:manage') ? (
            <FolderActions
              currentFolder={folder}
              folders={folders.filter((f) => f.id !== folder.id)}
            />
          ) : null
        }
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        {folders.length > 0 && (
          <nav aria-label="Folder tree" className="hidden w-[240px] shrink-0 lg:block">
            <h2 className="mb-3 font-mono text-meta-sm uppercase tracking-wider text-ink-secondary">
              Folders
            </h2>
            <FolderTree folders={folders} activeFolderId={folder.id} counts={counts} />
          </nav>
        )}

        <div className="min-w-0 flex-1">
          <LibraryView
            folder={folder}
            childFolders={childFolders}
            assets={assets}
            folders={folders.filter((f) => f.id !== folder.id)}
            tags={tags}
            collections={collections}
            folderCounts={Object.fromEntries(counts)}
            role={profile.role}
            currentUserId={profile.id}
          />
        </div>
      </div>
    </div>
  )
}
