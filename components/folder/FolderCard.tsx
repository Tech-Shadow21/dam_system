import Link from 'next/link'
import { FolderIcon } from '@/components/ui/Icon'
import type { Folder } from '@/types/database'

/**
 * Folder card per 04-frontend-specification.md: compact, icon + name + item
 * count, same border treatment as asset cards, no thumbnail.
 */
export function FolderCard({
  folder,
  assetCount,
}: {
  folder: Folder
  assetCount: number
}) {
  return (
    <Link
      href={`/library/${folder.id}`}
      className="group flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-shadow duration-150 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-canvas text-ink-secondary transition-colors group-hover:text-accent"
      >
        <FolderIcon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body-sm font-medium text-ink" title={folder.name}>
          {folder.name}
        </span>
        <span className="block font-mono text-meta-sm text-ink-secondary">
          {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
        </span>
      </span>
    </Link>
  )
}
