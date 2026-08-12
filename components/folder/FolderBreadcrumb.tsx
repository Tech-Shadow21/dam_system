import Link from 'next/link'
import { ChevronRightIcon, LibraryIcon } from '@/components/ui/Icon'
import type { Folder } from '@/types/database'

/**
 * Breadcrumb trail reflecting the current folder depth, each segment clickable
 * to navigate up (TICKET-006).
 */
export function FolderBreadcrumb({ path }: { path: Folder[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-body-sm">
        <li className="flex items-center gap-1">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 rounded px-1 py-0.5 text-ink-secondary transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LibraryIcon size={16} />
            Library
          </Link>
        </li>

        {path.map((folder, index) => {
          const isLast = index === path.length - 1
          return (
            <li key={folder.id} className="flex items-center gap-1">
              <ChevronRightIcon size={14} className="text-ink-secondary/50" />
              {isLast ? (
                <span aria-current="page" className="px-1 py-0.5 font-medium text-ink">
                  {folder.name}
                </span>
              ) : (
                <Link
                  href={`/library/${folder.id}`}
                  className="rounded px-1 py-0.5 text-ink-secondary transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {folder.name}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
