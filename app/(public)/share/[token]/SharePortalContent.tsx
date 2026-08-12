'use client'

import Image from 'next/image'
import { useState } from 'react'
import { assetKind, formatDate, formatFileSize } from '@/lib/utils'
import { FileTypeIcon } from '@/components/ui/Icon'
import { AssetPreview } from '@/components/asset/AssetPreview'

export interface PortalAsset {
  id: string
  filename: string
  fileType: string
  fileSizeBytes: number
  previewUrl: string | null
  thumbnailUrl: string | null
}

/**
 * Portal body: a single asset renders its preview directly; a folder or
 * collection renders a selectable gallery.
 *
 * Downloads point at /share/[token]/download/[assetId], which re-checks
 * allow_download server-side — hiding the button is presentation, not enforcement
 * (TICKET-016 acceptance criteria).
 */
export function SharePortalContent({
  token,
  targetLabel,
  assets,
  allowDownload,
  expiresAt,
}: {
  token: string
  targetLabel: string
  assets: PortalAsset[]
  allowDownload: boolean
  expiresAt: string
}) {
  const single = assets.length === 1
  const [activeId, setActiveId] = useState(assets[0]?.id ?? null)
  const active = assets.find((a) => a.id === activeId) ?? assets[0]

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-all font-display text-display font-medium text-ink">
            {targetLabel}
          </h1>
          <p className="mt-2 font-mono text-meta text-ink-secondary">
            {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · available until{' '}
            {formatDate(expiresAt)}
            {!allowDownload && ' · viewing only'}
          </p>
        </div>

        {allowDownload && active && (
          <DownloadButton token={token} assetId={active.id} label="Download" />
        )}
      </div>

      {active && (
        <div className="mb-8">
          <AssetPreview
            filename={active.filename}
            fileType={active.fileType}
            previewUrl={active.previewUrl}
            allowDownload={allowDownload}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="break-all text-body-sm font-medium text-ink">{active.filename}</p>
            <p className="font-mono text-meta-sm text-ink-secondary">
              {assetKind(active.fileType).toUpperCase()} ·{' '}
              {formatFileSize(active.fileSizeBytes)}
            </p>
          </div>
        </div>
      )}

      {!single && (
        <section>
          <h2 className="mb-4 font-display text-heading-sm font-medium text-ink">
            All assets
          </h2>
          <ul className="grid list-none grid-cols-assets gap-4">
            {assets.map((asset) => {
              const kind = assetKind(asset.fileType)
              const isActive = asset.id === active?.id
              return (
                <li key={asset.id} className="min-w-0">
                  <div
                    className={
                      isActive
                        ? 'overflow-hidden rounded-card border-2 bg-surface'
                        : 'overflow-hidden rounded-card border border-line bg-surface transition-shadow hover:shadow-card'
                    }
                    style={isActive ? { borderColor: 'var(--portal-accent)' } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(asset.id)}
                      aria-pressed={isActive}
                      className="block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-canvas text-ink-secondary">
                        {asset.thumbnailUrl ? (
                          <Image
                            src={asset.thumbnailUrl}
                            alt={asset.filename}
                            fill
                            sizes="(max-width: 640px) 50vw, 240px"
                            className="object-cover"
                          />
                        ) : (
                          <FileTypeIcon kind={kind} size={48} />
                        )}
                      </span>
                      <span className="block p-3">
                        <span
                          className="line-clamp-2 break-all text-body-sm font-medium text-ink"
                          title={asset.filename}
                        >
                          {asset.filename}
                        </span>
                        <span className="mt-1 block font-mono text-meta-sm uppercase text-ink-secondary">
                          {kind} · {formatFileSize(asset.fileSizeBytes)}
                        </span>
                      </span>
                    </button>

                    {allowDownload && (
                      <div className="border-t border-line px-3 py-2">
                        <DownloadButton
                          token={token}
                          assetId={asset.id}
                          label="Download"
                          compact
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function DownloadButton({
  token,
  assetId,
  label,
  compact = false,
}: {
  token: string
  assetId: string
  label: string
  compact?: boolean
}) {
  return (
    <a
      href={`/share/${token}/download/${assetId}`}
      // Brand colors are per-organization runtime values, so they're applied
      // inline rather than through theme tokens.
      style={{ backgroundColor: 'var(--portal-primary)', color: '#FFFFFF' }}
      className={
        compact
          ? 'inline-flex h-8 items-center justify-center gap-2 rounded-control px-4 font-sans text-meta font-medium transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          : 'inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 font-sans text-button font-medium transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4v12M7.5 11.5L12 16l4.5-4.5M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </a>
  )
}
