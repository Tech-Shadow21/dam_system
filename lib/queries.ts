import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getAssetThumbnailUrl } from '@/lib/storage/thumbnails'
import type { Asset, Folder, MetadataField, Tag, UserRecord } from '@/types/database'

/**
 * Shared server-side reads.
 *
 * Not in the file layout in 02-technical-architecture.md — added because the
 * folder tree, breadcrumb trail and tag list are needed by several routes, and
 * duplicating those queries per page would be the worse trade. Mutations still
 * live in colocated actions.ts files as the doc specifies.
 *
 * Every query here runs on the session client, so RLS scopes results to the
 * caller's organization; none of them filter by organization_id by hand.
 */

export interface AssetWithRelations extends Asset {
  tags: Tag[]
  uploader: Pick<UserRecord, 'id' | 'full_name' | 'email'> | null
  /** Resolved thumbnail URL, or null when the type has no image variant. */
  thumbnailUrl: string | null
}

const ASSET_SELECT = `
  *,
  asset_tags ( tags ( id, organization_id, name ) ),
  uploader:users!assets_uploaded_by_fkey ( id, full_name, email )
`

/** Normalises the nested Postgrest shape into something the UI can consume. */
type RawAsset = Asset & {
  asset_tags?: { tags: Tag | null }[] | null
  uploader?: Pick<UserRecord, 'id' | 'full_name' | 'email'> | null
}

async function decorate(rows: RawAsset[]): Promise<AssetWithRelations[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { asset_tags, uploader, ...asset } = row
      return {
        ...(asset as Asset),
        tags: (asset_tags ?? [])
          .map((t) => t.tags)
          .filter((t): t is Tag => t !== null)
          .sort((a, b) => a.name.localeCompare(b.name)),
        uploader: uploader ?? null,
        thumbnailUrl: await getAssetThumbnailUrl(asset as Asset),
      }
    })
  )
}

export async function getFolders(): Promise<Folder[]> {
  const supabase = createClient()
  const { data } = await supabase.from('folders').select('*').order('name')
  return data ?? []
}

/** Ancestor chain for the breadcrumb, root first. */
export async function getFolderPath(folderId: string | null): Promise<Folder[]> {
  if (!folderId) return []
  const folders = await getFolders()
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: Folder[] = []
  let current = byId.get(folderId)
  // Guard against a cycle: a malformed parent chain must not hang the request.
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parent_folder_id ? byId.get(current.parent_folder_id) : undefined
  }
  return path
}

export async function getFolder(folderId: string): Promise<Folder | null> {
  const supabase = createClient()
  const { data } = await supabase.from('folders').select('*').eq('id', folderId).maybeSingle()
  return data ?? null
}

/** Direct children of a folder (null = root level). */
export async function getChildFolders(parentId: string | null): Promise<Folder[]> {
  const supabase = createClient()
  const query = supabase.from('folders').select('*').order('name')
  const { data } = parentId
    ? await query.eq('parent_folder_id', parentId)
    : await query.is('parent_folder_id', null)
  return data ?? []
}

/** Per-folder asset counts, for the folder cards' item counts. */
export async function getFolderAssetCounts(): Promise<Map<string, number>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('assets')
    .select('folder_id')
    .eq('status', 'active')
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.folder_id) continue
    counts.set(row.folder_id, (counts.get(row.folder_id) ?? 0) + 1)
  }
  return counts
}

export async function getAssetsInFolder(
  folderId: string | null
): Promise<AssetWithRelations[]> {
  const supabase = createClient()
  const query = supabase
    .from('assets')
    .select(ASSET_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data } = folderId
    ? await query.eq('folder_id', folderId)
    : await query.is('folder_id', null)

  return decorate((data ?? []) as unknown as RawAsset[])
}

export async function getRecentAssets(limit = 12): Promise<AssetWithRelations[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('assets')
    .select(ASSET_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
  return decorate((data ?? []) as unknown as RawAsset[])
}

export async function getAsset(assetId: string): Promise<AssetWithRelations | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('assets')
    .select(ASSET_SELECT)
    .eq('id', assetId)
    .maybeSingle()
  if (!data) return null
  const [decorated] = await decorate([data as unknown as RawAsset])
  return decorated ?? null
}

export async function getTags(): Promise<Tag[]> {
  const supabase = createClient()
  const { data } = await supabase.from('tags').select('*').order('name')
  return data ?? []
}

export async function getMetadataFields(): Promise<MetadataField[]> {
  const supabase = createClient()
  const { data } = await supabase.from('metadata_fields').select('*').order('label')
  return data ?? []
}

export async function getOrgUsers(): Promise<UserRecord[]> {
  const supabase = createClient()
  const { data } = await supabase.from('users').select('*').order('full_name')
  return data ?? []
}

/** Storage footprint, shown in Settings > Organization. */
export async function getStorageUsage(): Promise<{ bytes: number; assetCount: number }> {
  const supabase = createClient()
  const { data } = await supabase
    .from('assets')
    .select('file_size_bytes')
    .neq('status', 'deleted')
  const rows = data ?? []
  return {
    bytes: rows.reduce((sum, r) => sum + Number(r.file_size_bytes ?? 0), 0),
    assetCount: rows.length,
  }
}

export interface CollectionWithCount {
  id: string
  name: string
  description: string | null
  created_at: string
  assetCount: number
}

export async function getCollections(): Promise<CollectionWithCount[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('collections')
    .select('*, collection_assets ( asset_id )')
    .order('name')

  return (data ?? []).map((row) => {
    const { collection_assets, ...collection } = row as typeof row & {
      collection_assets?: { asset_id: string }[] | null
    }
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      created_at: collection.created_at,
      assetCount: collection_assets?.length ?? 0,
    }
  })
}

export async function getCollectionAssets(
  collectionId: string
): Promise<AssetWithRelations[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('collection_assets')
    .select(`asset_id, assets ( ${ASSET_SELECT} )`)
    .eq('collection_id', collectionId)

  const assets = (data ?? [])
    .map((row) => (row as unknown as { assets: RawAsset | null }).assets)
    .filter((a): a is RawAsset => a !== null && a.status === 'active')

  return decorate(assets)
}

/** Collection ids an asset belongs to, for the detail view's collection picker. */
export async function getAssetCollectionIds(assetId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('collection_assets')
    .select('collection_id')
    .eq('asset_id', assetId)
  return (data ?? []).map((r) => r.collection_id)
}

export async function getAssetVersions(assetId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('asset_versions')
    .select('*, uploader:users!asset_versions_uploaded_by_fkey ( id, full_name, email )')
    .eq('asset_id', assetId)
    .order('version_number', { ascending: false })
  return data ?? []
}
