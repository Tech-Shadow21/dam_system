import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { env } from '@/lib/env'

/**
 * Supabase Storage client configuration.
 *
 * Replaces the former lib/r2/client.ts. Vaultra stores asset binaries in
 * Supabase Storage rather than Cloudflare R2 so the whole stack runs on
 * credentials the founder already has, and so permission logic stays in one
 * place (Postgres RLS) instead of being split between RLS and R2 presigned-URL
 * logic. See memory.md for the decision and its trade-off.
 */

export const BUCKET = env.storageBucket

/** Session-scoped storage client — subject to the bucket's RLS policies. */
export function storage() {
  return createServerSupabase().storage.from(BUCKET)
}

/**
 * Service-role storage client — bypasses bucket RLS. Used only for
 * thumbnail-variant writes and for signing downloads on the public share portal,
 * where there is no user session to authorise against.
 */
export function adminStorage() {
  return createAdminClient().storage.from(BUCKET)
}

/* ------------------------------ object paths ------------------------------ */

/**
 * Object key pattern, unchanged from the R2 design:
 *   org/{organization_id}/assets/{asset_id}/v{version_number}/{filename}
 *
 * The storage RLS policies parse segment [2] as the organization_id, so this
 * layout is load-bearing for access control — not just organisational tidiness.
 */
export function assetObjectPath(params: {
  organizationId: string
  assetId: string
  versionNumber: number
  filename: string
}): string {
  const { organizationId, assetId, versionNumber, filename } = params
  return `org/${organizationId}/assets/${assetId}/v${versionNumber}/${sanitizeFilename(filename)}`
}

/** Generated variants live alongside the versions they describe. */
export function variantObjectPath(params: {
  organizationId: string
  assetId: string
  variant: 'thumbnail' | 'preview'
}): string {
  const { organizationId, assetId, variant } = params
  return `org/${organizationId}/assets/${assetId}/variants/${variant}.webp`
}

export function brandingObjectPath(params: {
  organizationId: string
  filename: string
}): string {
  return `org/${params.organizationId}/branding/${sanitizeFilename(params.filename)}`
}

/**
 * Strips path separators and control characters so a crafted filename cannot
 * escape its organization prefix (which would defeat the storage RLS check).
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base
    // Control characters first, then anything outside the safe set.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 200)
  return cleaned.length > 0 ? cleaned : 'file'
}

/* -------------------------------- URLs ----------------------------------- */

/**
 * Public URL for an object. The bucket is private, so this is only meaningful
 * for objects in a public bucket; `signedUrl` is the normal path.
 */
export function publicUrl(objectPath: string): string {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl
}

/**
 * Short-lived signed URL. Used for previews, downloads and every share-portal
 * asset, so access always expires.
 */
export async function signedUrl(
  objectPath: string,
  expiresInSeconds = 3600,
  options?: { download?: string | boolean }
): Promise<string | null> {
  const { data, error } = await adminStorage().createSignedUrl(
    objectPath,
    expiresInSeconds,
    options?.download ? { download: options.download } : undefined
  )
  if (error || !data) return null
  return data.signedUrl
}

/** Removes objects, tolerating already-absent paths. */
export async function removeObjects(objectPaths: string[]): Promise<void> {
  if (objectPaths.length === 0) return
  await adminStorage().remove(objectPaths)
}
