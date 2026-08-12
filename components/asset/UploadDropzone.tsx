'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, formatFileSize } from '@/lib/utils'
import {
  ACCEPTED_MIME_TYPES,
  ACCEPTED_TYPES_LABEL,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/env'
import { Button } from '@/components/ui/Button'
import { UploadIcon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

/**
 * Drag-and-drop + file-picker upload with a per-file progress list (TICKET-007).
 *
 * Files go straight from the browser to Supabase Storage via a signed upload URL,
 * so large files never pass through the Next.js server. Progress comes from XHR
 * upload events — fetch() can't report upload progress.
 */

type UploadStatus = 'queued' | 'uploading' | 'finalizing' | 'done' | 'error'

interface QueueItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
}

let counter = 0
const nextId = () => `upload-${(counter += 1)}`

export function UploadDropzone({
  folderId,
  /** Set when replacing an existing asset's file (new version). */
  replaceAssetId,
  onComplete,
  compact = false,
}: {
  folderId: string | null
  replaceAssetId?: string
  onComplete?: () => void
  compact?: boolean
}) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const toast = useToast()

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  /** Client-side gate, matching the server's rules and messages exactly. */
  const validate = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) return 'File exceeds the 5 GB limit'
    const type = file.type || ''
    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(type)) {
      return `File type not supported. Accepted types: ${ACCEPTED_TYPES_LABEL}`
    }
    return null
  }, [])

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      update(item.id, { status: 'uploading', progress: 0, error: undefined })

      try {
        // 1. Prepare — validate server-side and mint a signed upload URL.
        const prepareRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: item.file.name,
            fileType: item.file.type,
            fileSizeBytes: item.file.size,
            folderId,
            replaceAssetId,
          }),
        })

        if (!prepareRes.ok) {
          const { error } = await prepareRes.json().catch(() => ({ error: null }))
          throw new Error(error ?? 'Could not prepare the upload')
        }

        const prepared = await prepareRes.json()

        // 2. Upload the bytes directly to Storage, reporting progress.
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', prepared.signedUrl, true)
          xhr.setRequestHeader('content-type', item.file.type || 'application/octet-stream')
          // Allows re-uploading the same version path after a failed attempt.
          xhr.setRequestHeader('x-upsert', 'true')

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              update(item.id, { progress: Math.round((e.loaded / e.total) * 100) })
            }
          }
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed (${xhr.status})`))
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.onabort = () => reject(new Error('Upload cancelled'))
          xhr.send(item.file)
        })

        // 3. Complete — the server verifies the object exists before writing rows.
        update(item.id, { status: 'finalizing', progress: 100 })

        const completeRes = await fetch('/api/upload', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            assetId: prepared.assetId,
            objectPath: prepared.objectPath,
            filename: item.file.name,
            fileType: item.file.type,
            fileSizeBytes: item.file.size,
            folderId: prepared.folderId,
            versionNumber: prepared.versionNumber,
            replaceAssetId,
          }),
        })

        if (!completeRes.ok) {
          const { error } = await completeRes.json().catch(() => ({ error: null }))
          throw new Error(error ?? 'Could not finish the upload')
        }

        update(item.id, { status: 'done', progress: 100 })
      } catch (err) {
        // Never auto-retry: a silent retry risks duplicate uploads
        // (03-security-access.md).
        update(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
    },
    [folderId, replaceAssetId, update]
  )

  const enqueue = useCallback(
    (files: File[]) => {
      if (files.length === 0) return

      const items: QueueItem[] = files.map((file) => {
        const error = validate(file)
        return {
          id: nextId(),
          file,
          status: error ? ('error' as const) : ('queued' as const),
          progress: 0,
          error: error ?? undefined,
        }
      })

      setQueue((prev) => [...prev, ...items])

      // Uploads run in parallel, each with its own progress indicator.
      const valid = items.filter((i) => i.status === 'queued')
      Promise.all(valid.map(uploadOne)).then(() => {
        router.refresh()
        onComplete?.()
        const failed = valid.length === 0
        if (!failed && valid.length > 0) {
          toast.success(
            valid.length === 1
              ? 'Upload complete.'
              : `${valid.length} uploads complete.`
          )
        }
      })
    },
    [validate, uploadOne, router, onComplete, toast]
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    enqueue(Array.from(e.dataTransfer.files))
  }

  const activeCount = queue.filter(
    (i) => i.status === 'uploading' || i.status === 'finalizing'
  ).length

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-card border-2 border-dashed text-center transition-colors',
          compact ? 'p-6' : 'p-8 sm:p-12',
          dragging
            ? 'border-accent bg-accent-muted'
            : 'border-line bg-surface/60 hover:border-ink-secondary/40'
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            dragging ? 'bg-accent/20 text-accent' : 'bg-canvas text-ink-secondary'
          )}
        >
          <UploadIcon size={22} />
        </div>

        <p className="font-display text-heading-sm font-medium text-ink">
          {replaceAssetId ? 'Upload a replacement file' : 'Drag files here to upload'}
        </p>
        <p className="mx-auto mt-2 max-w-[420px] text-body-sm text-ink-secondary">
          {replaceAssetId
            ? 'The current file is kept as a previous version and can be restored at any time.'
            : 'Or choose files from your computer. Up to 5 GB per file.'}
        </p>

        <div className="mt-6">
          <Button
            type="button"
            variant="hero"
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon size={18} />
            Choose {replaceAssetId ? 'file' : 'files'}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple={!replaceAssetId}
          accept={ACCEPTED_MIME_TYPES.join(',')}
          onChange={(e) => {
            enqueue(Array.from(e.target.files ?? []))
            // Reset so re-selecting the same file re-triggers onChange.
            e.target.value = ''
          }}
          className="hidden"
        />
      </div>

      {queue.length > 0 && (
        <ul
          className="mt-4 flex flex-col gap-2"
          aria-live="polite"
          aria-label={`Upload progress: ${activeCount} in progress`}
        >
          {queue.map((item) => (
            <QueueRow key={item.id} item={item} onRetry={() => uploadOne(item)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function QueueRow({ item, onRetry }: { item: QueueItem; onRetry: () => void }) {
  const statusLabel: Record<UploadStatus, string> = {
    queued: 'Queued',
    uploading: `${item.progress}%`,
    finalizing: 'Processing…',
    done: 'Complete',
    error: 'Failed',
  }

  return (
    <li className="rounded-card border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-medium text-ink" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="font-mono text-meta-sm text-ink-secondary">
            {formatFileSize(item.file.size)}
          </p>
        </div>

        <span
          className={cn(
            'shrink-0 font-mono text-meta-sm',
            item.status === 'error'
              ? 'text-error'
              : item.status === 'done'
                ? 'text-success'
                : 'text-ink-secondary'
          )}
        >
          {statusLabel[item.status]}
        </span>

        {item.status === 'error' && (
          <Button type="button" variant="secondary" size="compact" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>

      {(item.status === 'uploading' || item.status === 'finalizing') && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full border border-ink-secondary bg-line"
          role="progressbar"
          aria-valuenow={item.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${item.file.name}`}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}

      {item.status === 'error' && item.error && (
        <p className="mt-2 text-meta text-error" role="alert">
          {item.error}
        </p>
      )}
    </li>
  )
}
