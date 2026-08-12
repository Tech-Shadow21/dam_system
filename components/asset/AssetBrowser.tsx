'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { GridIcon, ListIcon } from '@/components/ui/Icon'
import { AssetCard } from './AssetCard'
import { AssetList, type SortDirection, type SortKey } from './AssetList'
import { BulkActionBar } from './BulkActionBar'
import { ShareLinkModal } from '@/components/share/ShareLinkModal'
import type { AssetWithRelations } from '@/lib/queries'
import type { Folder, Tag, UserRole } from '@/types/database'

/**
 * Grid/list browsing with multi-select and a bulk action bar (TICKET-008).
 *
 * The view preference is local component state rather than a persisted setting —
 * per-user view persistence isn't in the MVP scope.
 */
export function AssetBrowser({
  assets,
  folders,
  tags,
  collections,
  role,
  currentUserId,
  emptyState,
}: {
  assets: AssetWithRelations[]
  folders: Folder[]
  tags: Tag[]
  collections: { id: string; name: string }[]
  role: UserRole
  currentUserId: string
  emptyState: React.ReactNode
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'created_at',
    direction: 'desc',
  })
  const [shareAssetId, setShareAssetId] = useState<string | null>(null)
  const lastClickedIndex = useRef<number | null>(null)

  // Only roles that can act on a selection get selection affordances at all.
  const selectable =
    can(role, 'asset:update_own') ||
    can(role, 'asset:delete_own') ||
    can(role, 'asset_tag:write_own') ||
    can(role, 'collection:manage')

  const sorted = useMemo(() => {
    const copy = [...assets]
    const dir = sort.direction === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (sort.key) {
        case 'filename':
          return a.filename.localeCompare(b.filename) * dir
        case 'file_type':
          return a.file_type.localeCompare(b.file_type) * dir
        case 'file_size_bytes':
          return (Number(a.file_size_bytes) - Number(b.file_size_bytes)) * dir
        case 'uploader': {
          const an = a.uploader?.full_name || a.uploader?.email || ''
          const bn = b.uploader?.full_name || b.uploader?.email || ''
          return an.localeCompare(bn) * dir
        }
        case 'created_at':
        default:
          return (
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
          )
      }
    })
    return copy
  }, [assets, sort])

  /** Shift-click extends the selection from the last clicked row. */
  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      const index = sorted.findIndex((a) => a.id === id)
      setSelected((prev) => {
        const next = new Set(prev)
        if (shiftKey && lastClickedIndex.current !== null) {
          const [from, to] = [lastClickedIndex.current, index].sort((x, y) => x - y)
          for (let i = from; i <= to; i += 1) {
            const candidate = sorted[i]
            if (candidate) next.add(candidate.id)
          }
        } else if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
      lastClickedIndex.current = index
    },
    [sorted]
  )

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === sorted.length ? new Set() : new Set(sorted.map((a) => a.id))
    )
  }, [sorted])

  const onSortChange = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'created_at' ? 'desc' : 'asc' }
    )
  }, [])

  if (assets.length === 0) return <>{emptyState}</>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-meta-sm text-ink-secondary">
          {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
        </p>

        <div
          role="group"
          aria-label="View mode"
          className="flex items-center gap-1 rounded-control border border-line bg-surface p-1"
        >
          <ViewToggle
            active={view === 'grid'}
            onClick={() => setView('grid')}
            label="Grid view"
          >
            <GridIcon size={16} />
          </ViewToggle>
          <ViewToggle
            active={view === 'list'}
            onClick={() => setView('list')}
            label="List view"
          >
            <ListIcon size={16} />
          </ViewToggle>
        </div>
      </div>

      {view === 'grid' ? (
        <ul className="grid list-none grid-cols-assets gap-4">
          {sorted.map((asset) => (
            <li key={asset.id} className="min-w-0">
              <AssetCard
                asset={asset}
                selectable={selectable}
                selected={selected.has(asset.id)}
                onToggleSelect={toggleSelect}
              />
            </li>
          ))}
        </ul>
      ) : (
        <AssetList
          assets={sorted}
          selectedIds={selected}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          selectable={selectable}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}

      {selected.size > 0 && (
        <BulkActionBar
          selected={selected}
          assets={assets}
          folders={folders}
          tags={tags}
          collections={collections}
          role={role}
          currentUserId={currentUserId}
          onClear={() => setSelected(new Set())}
          onShare={() => setShareAssetId(Array.from(selected)[0] ?? null)}
        />
      )}

      {shareAssetId && (
        <ShareLinkModal
          open
          onClose={() => setShareAssetId(null)}
          targetType="asset"
          targetId={shareAssetId}
          targetLabel={assets.find((a) => a.id === shareAssetId)?.filename ?? 'asset'}
        />
      )}
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'rounded-[4px] p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        active
          ? 'bg-primary text-white'
          : 'text-ink-secondary hover:bg-canvas hover:text-ink'
      )}
    >
      {children}
    </button>
  )
}
