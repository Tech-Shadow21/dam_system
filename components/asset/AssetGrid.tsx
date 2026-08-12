'use client'

import { AssetCard } from './AssetCard'
import type { AssetWithRelations } from '@/lib/queries'
import type { UserRole } from '@/types/database'

/**
 * Read-only responsive asset grid — auto-fill columns, min card width 200px,
 * 16px gutter, per the layout rules. Used where selection isn't needed (home,
 * share portal). The library/collection/search views use AssetBrowser, which
 * adds the view toggle and multi-select.
 */
export function AssetGrid({
  assets,
  hrefFor,
}: {
  assets: AssetWithRelations[]
  role?: UserRole
  currentUserId?: string
  hrefFor?: (asset: AssetWithRelations) => string
}) {
  return (
    <ul className="grid list-none grid-cols-assets gap-4">
      {assets.map((asset) => (
        <li key={asset.id} className="min-w-0">
          <AssetCard asset={asset} href={hrefFor?.(asset)} />
        </li>
      ))}
    </ul>
  )
}
