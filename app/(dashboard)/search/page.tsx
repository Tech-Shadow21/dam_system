import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAssetThumbnailUrl } from '@/lib/storage/thumbnails'
import {
  getCollections,
  getFolders,
  getOrgUsers,
  getTags,
  type AssetWithRelations,
} from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchIcon } from '@/components/ui/Icon'
import { AssetBrowser } from '@/components/asset/AssetBrowser'
import { SearchFilters } from './SearchFilters'
import type { Asset, Tag } from '@/types/database'

export const metadata: Metadata = { title: 'Search — Vaultra' }

interface SearchParams {
  q?: string
  folder?: string
  kind?: string | string[]
  tag?: string | string[]
  uploader?: string
  from?: string
  to?: string
  collection?: string
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Search & filter view (TICKET-013).
 *
 * Filtering runs through the search_assets() Postgres function so AND-combining
 * happens in one place, in the database, under RLS.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { profile } = await requireSession()
  const supabase = createClient()

  const kinds = toArray(searchParams.kind)
  const tagIds = toArray(searchParams.tag)

  const hasCriteria =
    Boolean(searchParams.q?.trim()) ||
    Boolean(searchParams.folder) ||
    Boolean(searchParams.uploader) ||
    Boolean(searchParams.from) ||
    Boolean(searchParams.to) ||
    Boolean(searchParams.collection) ||
    kinds.length > 0 ||
    tagIds.length > 0

  const [folders, tags, users, collections] = await Promise.all([
    getFolders(),
    getTags(),
    getOrgUsers(),
    getCollections(),
  ])

  let assets: AssetWithRelations[] = []
  let failed = false

  if (hasCriteria) {
    const { data, error } = await supabase.rpc('search_assets', {
      p_query: searchParams.q?.trim() || null,
      p_folder_id: searchParams.folder || null,
      p_file_kinds: kinds.length > 0 ? kinds : null,
      p_tag_ids: tagIds.length > 0 ? tagIds : null,
      p_uploader_id: searchParams.uploader || null,
      p_date_from: searchParams.from || null,
      // `to` is inclusive of the chosen day; the function compares with `<`.
      p_date_to: searchParams.to ? `${searchParams.to}T23:59:59.999Z` : null,
      p_collection_id: searchParams.collection || null,
    })

    if (error) {
      console.error('[search]', error)
      failed = true
    } else {
      const rows = (data ?? []) as Asset[]

      // search_assets returns bare asset rows; hydrate tags/uploader for display.
      const ids = rows.map((r) => r.id)
      const [tagRows, userRows] = await Promise.all([
        ids.length
          ? supabase
              .from('asset_tags')
              .select('asset_id, tags ( id, organization_id, name )')
              .in('asset_id', ids)
          : Promise.resolve({ data: [] as unknown[] }),
        Promise.resolve({ data: users }),
      ])

      const tagsByAsset = new Map<string, Tag[]>()
      for (const row of (tagRows.data ?? []) as { asset_id: string; tags: Tag | null }[]) {
        if (!row.tags) continue
        const list = tagsByAsset.get(row.asset_id) ?? []
        list.push(row.tags)
        tagsByAsset.set(row.asset_id, list)
      }
      const usersById = new Map(userRows.data.map((u) => [u.id, u]))

      assets = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          tags: (tagsByAsset.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
          uploader: row.uploaded_by
            ? (() => {
                const u = usersById.get(row.uploaded_by)
                return u ? { id: u.id, full_name: u.full_name, email: u.email } : null
              })()
            : null,
          thumbnailUrl: await getAssetThumbnailUrl(row),
        }))
      )
    }
  }

  return (
    <div>
      <PageHeader
        title="Search"
        description="Find assets by filename, tag or metadata value, then narrow with filters."
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[280px]">
          <SearchFilters
            folders={folders}
            tags={tags}
            users={users}
            collections={collections.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>

        <div className="min-w-0 flex-1">
          {failed ? (
            <EmptyState
              icon={<SearchIcon size={22} />}
              title="Search is unavailable right now"
              description="Something went wrong on our end — please try again."
            />
          ) : !hasCriteria ? (
            <EmptyState
              icon={<SearchIcon size={22} />}
              title="Search your archive"
              description="Enter a keyword above, or pick a filter to browse by file type, tag, uploader or date."
            />
          ) : (
            <AssetBrowser
              assets={assets}
              folders={folders}
              tags={tags}
              collections={collections.map((c) => ({ id: c.id, name: c.name }))}
              role={profile.role}
              currentUserId={profile.id}
              emptyState={
                <EmptyState
                  icon={<SearchIcon size={22} />}
                  title="No assets match those filters"
                  description="Try a different keyword, or clear a filter to widen the search."
                />
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
