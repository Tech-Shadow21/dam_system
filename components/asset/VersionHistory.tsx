'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime, formatFileSize } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { restoreVersionAction } from '@/app/(dashboard)/library/actions'

export interface VersionRow {
  id: string
  version_number: number
  file_size_bytes: number
  created_at: string
  uploader?: { full_name: string | null; email: string } | null
}

/**
 * Version history panel (TICKET-010): every version in reverse-chronological
 * order, with restore.
 *
 * Restoring is additive — it copies the chosen version forward as a new current
 * version rather than rewinding, so history is never lost. The confirmation copy
 * says so.
 */
export function VersionHistory({
  assetId,
  versions,
  currentVersion,
  canRestore,
}: {
  assetId: string
  versions: VersionRow[]
  currentVersion: number
  canRestore: boolean
}) {
  const [restoring, setRestoring] = useState<VersionRow | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function restore(version: VersionRow) {
    startTransition(async () => {
      const result = await restoreVersionAction({
        assetId,
        versionNumber: version.version_number,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not restore that version.')
        return
      }
      toast.success(`Version ${version.version_number} restored as the current file.`)
      setRestoring(null)
      router.refresh()
    })
  }

  if (versions.length === 0) {
    return <p className="text-body-sm text-ink-secondary">No version history yet.</p>
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {versions.map((version) => {
          const isCurrent = version.version_number === currentVersion
          return (
            <li
              key={version.id}
              className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-3 py-2"
            >
              <Badge tone={isCurrent ? 'accent' : 'neutral'} mono>
                v{version.version_number}
              </Badge>

              <div className="min-w-0 flex-1">
                <p className="text-meta text-ink">
                  {version.uploader?.full_name?.trim() || version.uploader?.email || 'Unknown'}
                </p>
                <p className="font-mono text-meta-sm text-ink-secondary">
                  {formatDateTime(version.created_at)} · {formatFileSize(version.file_size_bytes)}
                </p>
              </div>

              {isCurrent ? (
                <span className="font-mono text-meta-sm text-success">current</span>
              ) : (
                canRestore && (
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => setRestoring(version)}
                  >
                    Restore
                  </Button>
                )
              )}
            </li>
          )
        })}
      </ol>

      <ConfirmModal
        open={restoring !== null}
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) restore(restoring)
        }}
        title={`Restore version ${restoring?.version_number ?? ''}?`}
        description={`This becomes version ${currentVersion + 1} and the current file. Nothing is deleted — every earlier version stays in the history.`}
        confirmLabel="Restore version"
        destructive={false}
        loading={pending}
      />
    </>
  )
}
