/**
 * Central env access. Kept deliberately lazy: reading a missing value throws at
 * the point of use rather than at import time, so `next build` and type-checking
 * succeed without secrets present (see memory.md — this build was authored
 * against placeholder credentials).
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.startsWith('placeholder')) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (see 02-technical-architecture.md).`
    )
  }
  return value
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]
  return value && !value.startsWith('placeholder') ? value : fallback
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
  /** Non-secret. Bucket holding all asset binaries and generated variants. */
  get storageBucket() {
    return optional('SUPABASE_STORAGE_BUCKET', 'vaultra-assets')
  },
  get appUrl() {
    return optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  },
  get shareLinkSigningSecret() {
    return required('SHARE_LINK_SIGNING_SECRET')
  },
}

/** True when live credentials look present — used to surface a clear setup notice. */
export function hasSupabaseCredentials(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(
    url && key && !url.startsWith('placeholder') && !key.startsWith('placeholder')
  )
}

/** Maximum upload size — 5 GB per 03-security-access.md. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024

export const ACCEPTED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/tiff',
  // Video
  'video/mp4',
  'video/quicktime',
  'video/webm',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Design files
  'image/vnd.adobe.photoshop',
  'application/postscript',
  'application/zip',
] as const

export const ACCEPTED_TYPES_LABEL =
  'images (JPG, PNG, GIF, WebP, SVG, TIFF), video (MP4, MOV, WebM), documents (PDF, Word, Excel, PowerPoint, TXT, CSV) and design files (PSD, AI, ZIP)'
