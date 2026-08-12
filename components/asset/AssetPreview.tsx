import Image from 'next/image'
import { assetKind } from '@/lib/utils'
import { FileTypeIcon } from '@/components/ui/Icon'

/**
 * In-browser preview for the detail page (TICKET-009). Images, video and PDF all
 * render inline without forcing a download; other types show a file-type icon.
 *
 * `previewUrl` is a short-lived signed URL — the bucket is private, so nothing is
 * served from a permanent public address.
 */
export function AssetPreview({
  filename,
  fileType,
  previewUrl,
  downloadUrl,
  allowDownload = true,
}: {
  filename: string
  fileType: string
  /** Signed URL for the displayable variant (or the original for video/PDF). */
  previewUrl: string | null
  /** Signed URL for the original file, when downloads are permitted. */
  downloadUrl?: string | null
  allowDownload?: boolean
}) {
  const kind = assetKind(fileType)

  if (!previewUrl) {
    return (
      <PreviewFrame>
        <div className="flex flex-col items-center gap-4 py-12 text-ink-secondary">
          <FileTypeIcon kind={kind} size={64} />
          <p className="text-body-sm">Preview unavailable</p>
        </div>
      </PreviewFrame>
    )
  }

  if (kind === 'image') {
    return (
      <PreviewFrame>
        <div className="relative min-h-[320px] w-full">
          <Image
            src={previewUrl}
            alt={filename}
            fill
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-contain"
            priority
          />
        </div>
      </PreviewFrame>
    )
  }

  if (kind === 'video') {
    return (
      <PreviewFrame>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded
            media; captions aren't available and aren't in MVP scope. */}
        <video
          src={previewUrl}
          controls
          controlsList={allowDownload ? undefined : 'nodownload'}
          preload="metadata"
          className="max-h-[70vh] w-full bg-ink"
          aria-label={`Video preview of ${filename}`}
        />
      </PreviewFrame>
    )
  }

  if (kind === 'pdf') {
    return (
      <PreviewFrame>
        {/* #toolbar=0 hides the built-in download button when downloads are
            blocked. It's a UI nicety, not the enforcement — that's server-side. */}
        <iframe
          src={`${previewUrl}${allowDownload ? '' : '#toolbar=0'}`}
          title={`PDF preview of ${filename}`}
          className="h-[70vh] min-h-[480px] w-full bg-canvas"
        />
      </PreviewFrame>
    )
  }

  return (
    <PreviewFrame>
      <div className="flex flex-col items-center gap-4 py-12 text-ink-secondary">
        <FileTypeIcon kind={kind} size={64} />
        <p className="max-w-[320px] text-center text-body-sm">
          This file type can&rsquo;t be previewed in the browser.
          {allowDownload && downloadUrl ? ' Download it to view.' : ''}
        </p>
      </div>
    </PreviewFrame>
  )
}

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center overflow-hidden rounded-card border border-line bg-canvas">
      {children}
    </div>
  )
}
