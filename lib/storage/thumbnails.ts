import 'server-only'

import sharp from 'sharp'
import { supportsThumbnail } from '@/lib/utils'
import { signedUrl, variantObjectPath } from './client'
import { downloadObject, uploadBuffer } from './upload'

/**
 * sharp-based thumbnail/preview generation.
 *
 * Replaces the former lib/r2/thumbnails.ts. Variants are written back to the
 * same Supabase Storage bucket under a variants/ path, and the resulting URL is
 * stored as assets.cdn_url. The original in r2_key remains the source of truth.
 *
 * Scope note (04-frontend-specification.md): only images get generated variants.
 * PDFs and video use a generic file-type icon in grid/card views for MVP.
 */

/** Grid cards are min 200px wide; 2x that covers retina without wasting space. */
const THUMBNAIL_WIDTH = 400
/** Detail-view preview, large enough for the asset detail page. */
const PREVIEW_WIDTH = 1600

export interface GeneratedVariants {
  thumbnailPath: string | null
  previewPath: string | null
  /** Signed URL for the thumbnail, stored as assets.cdn_url. */
  cdnUrl: string | null
  width: number | null
  height: number | null
}

const EMPTY: GeneratedVariants = {
  thumbnailPath: null,
  previewPath: null,
  cdnUrl: null,
  width: null,
  height: null,
}

/**
 * Signed URLs expire, so cdn_url is a cache rather than a permanent address.
 * A long window keeps grid rendering cheap; getAssetThumbnailUrl() re-signs on
 * demand when a stored URL has aged out.
 */
export const VARIANT_URL_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

/**
 * Generates thumbnail + preview variants for an image that has just landed in
 * storage. Returns EMPTY (rather than throwing) for non-images and for failures:
 * a missing thumbnail must never fail the upload itself, since the original file
 * is already safely stored and the UI falls back to a file-type icon.
 */
export async function generateImageVariants(params: {
  organizationId: string
  assetId: string
  objectPath: string
  mimeType: string
}): Promise<GeneratedVariants> {
  const { organizationId, assetId, objectPath, mimeType } = params

  if (!supportsThumbnail(mimeType)) return EMPTY

  const { buffer, error } = await downloadObject(objectPath)
  if (error || !buffer) {
    console.error('[thumbnails] could not read original', objectPath, error)
    return EMPTY
  }

  try {
    // failOnError:false so a slightly malformed but renderable image still works.
    const image = sharp(buffer, { failOn: 'none' })
    const meta = await image.metadata()

    const thumbnailPath = variantObjectPath({ organizationId, assetId, variant: 'thumbnail' })
    const previewPath = variantObjectPath({ organizationId, assetId, variant: 'preview' })

    const thumbnail = await sharp(buffer, { failOn: 'none' })
      .rotate() // honour EXIF orientation
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()

    const preview = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer()

    const [thumbUpload, previewUpload] = await Promise.all([
      uploadBuffer({
        objectPath: thumbnailPath,
        body: thumbnail,
        contentType: 'image/webp',
      }),
      uploadBuffer({
        objectPath: previewPath,
        body: preview,
        contentType: 'image/webp',
      }),
    ])

    if (thumbUpload.error || previewUpload.error) {
      console.error(
        '[thumbnails] variant upload failed',
        thumbUpload.error ?? previewUpload.error
      )
      return EMPTY
    }

    const cdnUrl = await signedUrl(thumbnailPath, VARIANT_URL_TTL_SECONDS)

    return {
      thumbnailPath,
      previewPath,
      cdnUrl,
      width: meta.width ?? null,
      height: meta.height ?? null,
    }
  } catch (err) {
    console.error('[thumbnails] sharp failed', err)
    return EMPTY
  }
}

/** Resizes an org logo before storing it (TICKET-017). */
export async function processLogo(
  buffer: Buffer
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const body = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer()
    return { body, contentType: 'image/webp' }
  } catch (err) {
    console.error('[thumbnails] logo processing failed', err)
    return null
  }
}

/**
 * Resolves a usable thumbnail URL for an asset, re-signing if the stored
 * cdn_url has expired. Returns null when the asset has no image variant, and the
 * caller renders a file-type icon instead.
 */
export async function getAssetThumbnailUrl(asset: {
  id: string
  organization_id: string
  file_type: string
  cdn_url: string | null
}): Promise<string | null> {
  if (!supportsThumbnail(asset.file_type)) return null
  if (asset.cdn_url && !isSignedUrlExpired(asset.cdn_url)) return asset.cdn_url

  return signedUrl(
    variantObjectPath({
      organizationId: asset.organization_id,
      assetId: asset.id,
      variant: 'thumbnail',
    }),
    VARIANT_URL_TTL_SECONDS
  )
}

/**
 * Supabase signs URLs with a JWT in the `token` query param whose `exp` claim
 * tells us when it dies. Treat anything unparseable as expired so we re-sign
 * rather than render a broken image.
 */
export function isSignedUrlExpired(url: string): boolean {
  try {
    const token = new URL(url).searchParams.get('token')
    if (!token) return true
    const [, payload] = token.split('.')
    if (!payload) return true
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    ) as { exp?: number }
    if (typeof decoded.exp !== 'number') return true
    // Refresh a little early so a URL cannot expire mid-render.
    return decoded.exp * 1000 - 60_000 < Date.now()
  } catch {
    return true
  }
}
