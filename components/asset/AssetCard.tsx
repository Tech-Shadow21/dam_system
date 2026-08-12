'use client'

import Image from 'next/image'
import Link from 'next/link'
import { assetKind, cn, formatFileSize } from '@/lib/utils'
import { FileTypeIcon } from '@/components/ui/Icon'
import { TagChip } from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/Input'
import type { AssetWithRelations } from '@/lib/queries'

/**
 * Asset card per 04-frontend-specification.md: white surface, 8px radius, 1px
 * border, shadow only on hover so the grid stays calm at scale. Thumbnail fills
 * the top, metadata strip below. Selected state is a 2px brass border rather
 * than a color fill, to keep multi-select grids legible.
 *
 * Images use the sharp-generated variant through next/image. PDFs, video and
 * other types show a generic file-type icon (MVP scope).
 */
export function AssetCard({
  asset,
  selected = false,
  onToggleSelect,
  selectable = false,
  href,
}: {
  asset: AssetWithRelations
  selected?: boolean
  onToggleSelect?: (assetId: string, shiftKey: boolean) => void
  selectable?: boolean
  href?: string
}) {
  const kind = assetKind(asset.file_type)
  const target = href ?? `/library/asset/${asset.id}`

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card bg-surface transition-shadow duration-150 hover:shadow-card',
        selected ? 'border-2 border-accent' : 'border border-line'
      )}
    >
      {selectable && (
        <div
          className={cn(
            'absolute left-2 top-2 z-10 rounded-control bg-surface/95 p-1 shadow-control transition-opacity',
            // Always visible once selected; otherwise reveal on hover/focus so
            // the resting grid stays uncluttered.
            selected
              ? 'opacity-100'
              : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
          )}
        >
          <Checkbox
            checked={selected}
            onChange={(e) =>
              onToggleSelect?.(
                asset.id,
                (e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey ?? false
              )
            }
            aria-label={`Select ${asset.filename}`}
          />
        </div>
      )}

      <Link
        href={target}
        className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas">
          {asset.thumbnailUrl ? (
            <Image
              src={asset.thumbnailUrl}
              alt={asset.filename}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
              className="object-cover"
              // Thumbnails are decorative-adjacent; a failure falls back to bg.
              unoptimized={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-secondary">
              <FileTypeIcon kind={kind} size={48} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <p
            className="line-clamp-2 break-all text-body-sm font-medium text-ink"
            title={asset.filename}
          >
            {asset.filename}
          </p>
          <p className="font-mono text-meta-sm uppercase tracking-wide text-ink-secondary">
            {kind} · {formatFileSize(asset.file_size_bytes)}
            {asset.current_version > 1 && ` · v${asset.current_version}`}
          </p>

          {asset.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1 pt-1">
              {asset.tags.slice(0, 3).map((tag) => (
                <TagChip key={tag.id} label={tag.name} />
              ))}
              {asset.tags.length > 3 && (
                <span className="self-center font-mono text-meta-sm text-ink-secondary">
                  +{asset.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
