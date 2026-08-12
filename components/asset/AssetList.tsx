'use client'

import Image from 'next/image'
import Link from 'next/link'
import { assetKind, cn, formatDate, formatFileSize } from '@/lib/utils'
import { FileTypeIcon } from '@/components/ui/Icon'
import { Checkbox } from '@/components/ui/Input'
import type { AssetWithRelations } from '@/lib/queries'

export type SortKey = 'filename' | 'file_type' | 'file_size_bytes' | 'uploader' | 'created_at'
export type SortDirection = 'asc' | 'desc'

/**
 * Dense sortable list view (TICKET-008): filename, type, size, uploader, date.
 */
export function AssetList({
  assets,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  selectable,
  sort,
  onSortChange,
}: {
  assets: AssetWithRelations[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, shiftKey: boolean) => void
  onToggleAll: () => void
  selectable: boolean
  sort: { key: SortKey; direction: SortDirection }
  onSortChange: (key: SortKey) => void
}) {
  const allSelected = assets.length > 0 && assets.every((a) => selectedIds.has(a.id))

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'filename', label: 'Name' },
    { key: 'file_type', label: 'Type', className: 'hidden sm:table-cell' },
    { key: 'file_size_bytes', label: 'Size', className: 'hidden sm:table-cell' },
    { key: 'uploader', label: 'Uploaded by', className: 'hidden lg:table-cell' },
    { key: 'created_at', label: 'Date', className: 'hidden md:table-cell' },
  ]

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <caption className="sr-only">
          Assets, sortable by name, type, size, uploader and date
        </caption>
        <thead>
          <tr className="border-b border-line">
            {selectable && (
              <th scope="col" className="w-10 px-4 py-3">
                <Checkbox
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label={allSelected ? 'Deselect all assets' : 'Select all assets'}
                />
              </th>
            )}
            {columns.map((col) => {
              const active = sort.key === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn('px-4 py-3', col.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className={cn(
                      'inline-flex items-center gap-1 font-mono text-meta-sm uppercase tracking-wider transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      active ? 'text-primary' : 'text-ink-secondary hover:text-ink'
                    )}
                  >
                    {col.label}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      aria-hidden="true"
                      className={cn(
                        'transition-transform',
                        active ? 'opacity-100' : 'opacity-0',
                        active && sort.direction === 'asc' && 'rotate-180'
                      )}
                    >
                      <path d="M5 8L1.5 3h7L5 8z" fill="currentColor" />
                    </svg>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {assets.map((asset) => {
            const kind = assetKind(asset.file_type)
            const selected = selectedIds.has(asset.id)
            return (
              <tr
                key={asset.id}
                className={cn(
                  'border-b border-line last:border-0 transition-colors',
                  selected ? 'bg-accent-muted' : 'hover:bg-canvas/60'
                )}
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected}
                      onChange={(e) =>
                        onToggleSelect(
                          asset.id,
                          (e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey ?? false
                        )
                      }
                      aria-label={`Select ${asset.filename}`}
                    />
                  </td>
                )}

                <td className="px-4 py-3">
                  <Link
                    href={`/library/asset/${asset.id}`}
                    className="flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-control bg-canvas text-ink-secondary">
                      {asset.thumbnailUrl ? (
                        <Image
                          src={asset.thumbnailUrl}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <FileTypeIcon kind={kind} size={22} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block truncate text-body-sm font-medium text-ink"
                        title={asset.filename}
                      >
                        {asset.filename}
                      </span>
                      {asset.current_version > 1 && (
                        <span className="font-mono text-meta-sm text-ink-secondary">
                          v{asset.current_version}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>

                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="font-mono text-meta-sm uppercase text-ink-secondary">
                    {kind}
                  </span>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="font-mono text-meta-sm text-ink-secondary">
                    {formatFileSize(asset.file_size_bytes)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <span className="text-meta text-ink-secondary">
                    {asset.uploader?.full_name?.trim() || asset.uploader?.email || '—'}
                  </span>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="font-mono text-meta-sm text-ink-secondary">
                    {formatDate(asset.created_at)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
