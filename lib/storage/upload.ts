import 'server-only'

import { adminStorage, assetObjectPath, storage } from './client'

/**
 * Signed upload URL generation.
 *
 * Replaces the former lib/r2/upload.ts (presigned S3 PUT). The browser uploads
 * directly to Supabase Storage using a short-lived signed token, so large files
 * never pass through the Next.js server — the same property the R2 presigned-URL
 * design had.
 */

export interface SignedUpload {
  /** Storage object path, written to assets.r2_key / asset_versions.r2_key. */
  objectPath: string
  /** Endpoint the browser PUTs to. */
  signedUrl: string
  /** Opaque token the browser passes back with the upload. */
  token: string
}

/**
 * Mints a signed upload URL for a specific asset version.
 *
 * Uses the caller's session client, so the bucket's RLS policies decide whether
 * this user may write to this organization's prefix at all — the permission check
 * is not merely an app-layer one.
 */
export async function createSignedUpload(params: {
  organizationId: string
  assetId: string
  versionNumber: number
  filename: string
}): Promise<{ data: SignedUpload | null; error: string | null }> {
  const objectPath = assetObjectPath(params)

  const { data, error } = await storage().createSignedUploadUrl(objectPath)

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Could not prepare the upload' }
  }

  return {
    data: { objectPath, signedUrl: data.signedUrl, token: data.token },
    error: null,
  }
}

/**
 * Server-side upload of a buffer we already hold — used for generated thumbnail
 * variants and for org logos, which are processed by sharp before storage.
 * Runs with the service-role client because the variant write happens after the
 * user's request has already been authorised.
 */
export async function uploadBuffer(params: {
  objectPath: string
  body: Buffer | Uint8Array
  contentType: string
  upsert?: boolean
}): Promise<{ error: string | null }> {
  const { objectPath, body, contentType, upsert = true } = params
  const { error } = await adminStorage().upload(objectPath, body, {
    contentType,
    upsert,
  })
  return { error: error?.message ?? null }
}

/** Downloads an object server-side, e.g. to feed the original into sharp. */
export async function downloadObject(
  objectPath: string
): Promise<{ buffer: Buffer | null; error: string | null }> {
  const { data, error } = await adminStorage().download(objectPath)
  if (error || !data) {
    return { buffer: null, error: error?.message ?? 'Could not read the stored file' }
  }
  const arrayBuffer = await data.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), error: null }
}

/** Confirms an object actually landed, so a failed upload is never marked complete. */
export async function objectExists(objectPath: string): Promise<boolean> {
  const lastSlash = objectPath.lastIndexOf('/')
  const dir = objectPath.slice(0, lastSlash)
  const name = objectPath.slice(lastSlash + 1)
  const { data, error } = await adminStorage().list(dir, { search: name, limit: 100 })
  if (error || !data) return false
  return data.some((entry) => entry.name === name)
}
