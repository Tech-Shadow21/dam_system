import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Human-readable file size. Rendered in IBM Plex Mono per the type spec. */
export function formatFileSize(bytes: number | string | null | undefined): string {
  const n = typeof bytes === 'string' ? Number(bytes) : bytes
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, i)
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—'
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—'
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Broad category used to pick previews and file-type icons. */
export type AssetKind = 'image' | 'video' | 'pdf' | 'document' | 'design' | 'other'

export function assetKind(mimeType: string | null | undefined): AssetKind {
  const t = (mimeType ?? '').toLowerCase()
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t === 'application/pdf') return 'pdf'
  if (
    t.startsWith('text/') ||
    t.includes('word') ||
    t.includes('spreadsheet') ||
    t.includes('presentation') ||
    t.includes('excel') ||
    t.includes('powerpoint')
  ) {
    return 'document'
  }
  if (t.includes('photoshop') || t.includes('illustrator') || t.includes('sketch')) {
    return 'design'
  }
  return 'other'
}

/** Only images get sharp-generated variants; everything else uses an icon (MVP scope). */
export function supportsThumbnail(mimeType: string | null | undefined): boolean {
  const t = (mimeType ?? '').toLowerCase()
  // SVG is an image but sharp rasterizing it is unnecessary and a minor attack
  // surface; it renders fine directly.
  return t.startsWith('image/') && t !== 'image/svg+xml'
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name?.trim()) return fallback
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
