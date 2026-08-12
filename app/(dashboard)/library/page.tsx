import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import {
  getAssetsInFolder,
  getChildFolders,
  getCollections,
  getFolderAssetCounts,
  getFolders,
  getTags,
} from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { FolderActions } from '@/components/folder/FolderActions'
import { FolderTree } from '@/components/folder/FolderTree'
import { LibraryView } from './LibraryView'

export const metadata: Metadata = { title: 'Library — Vaultra' }

/** Library root: top-level folders plus any unfiled assets. */
export default async function LibraryPage() {
  const { profile } = await requireSession()

  const [childFolders, assets, folders, tags, collections, counts] = await Promise.all([
    getChildFolders(null),
    getAssetsInFolder(null),
    getFolders(),
    getTags(),
    getCollections(),
    getFolderAssetCounts(),
  ])

  return (
    <div>
      <PageHeader
        title="Library"
        description="Browse every asset in your organization by folder."
        actions={
          can(profile.role, 'folder:manage') ? (
            <FolderActions currentFolder={null} folders={folders} />
          ) : null
        }
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Folder tree — a navigation aid, hidden on narrow screens where the
            breadcrumb and folder cards are enough. */}
        {folders.length > 0 && (
          <nav
            aria-label="Folder tree"
            className="hidden w-[240px] shrink-0 lg:block"
          >
            <h2 className="mb-3 font-mono text-meta-sm uppercase tracking-wider text-ink-secondary">
              Folders
            </h2>
            <FolderTree folders={folders} activeFolderId={null} counts={counts} />
          </nav>
        )}

        <div className="min-w-0 flex-1">
          <LibraryView
            folder={null}
            childFolders={childFolders}
            assets={assets}
            folders={folders}
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
