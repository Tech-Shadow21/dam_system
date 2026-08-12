'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { LockIcon } from '@/components/ui/Icon'
import { revokeShareLinkAction } from './actions'
import type { UserRole } from '@/types/database'

export interface ShareRow {
  id: string
  url: string
  target: { type: 'asset' | 'folder' | 'collection'; label: string; href: string | null }
  status: 'active' | 'expired' | 'revoked'
  expiresAt: string
  revokedAt: string | null
  allowDownload: boolean
  passwordProtected: boolean
  accessCount: number
  createdAt: string
  createdBy: string
  isOwn: boolean
}

const statusTone = {
  active: 'success',
  expired: 'neutral',
  revoked: 'error',
} as const

export function SharesTable({ rows, role }: { rows: ShareRow[]; role: UserRole }) {
  const [revoking, setRevoking] = useState<ShareRow | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy — select the link and copy manually.')
    }
  }

  function revoke(row: ShareRow) {
    startTransition(async () => {
      const result = await revokeShareLinkAction(row.id)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not revoke that link.')
        return
      }
      setRevoking(null)
      toast.success('Link revoked. It no longer grants access.')
      router.refresh()
    })
  }

  const canRevoke = (row: ShareRow) =>
    row.status === 'active' && (can(role, 'share_link:manage_any') || row.isOwn)

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Share links with status and actions</caption>
          <thead>
            <tr className="border-b border-line">
              {['Shared item', 'Status', 'Expires', 'Views', 'Created by', ''].map(
                (heading, i) => (
                  <th
                    key={heading || i}
                    scope="col"
                    className="px-4 py-3 font-mono text-meta-sm uppercase tracking-wider text-ink-secondary"
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {row.target.href ? (
                      <Link
                        href={row.target.href}
                        className="truncate text-body-sm font-medium text-ink transition-colors hover:text-primary"
                      >
                        {row.target.label}
                      </Link>
                    ) : (
                      <span className="text-body-sm font-medium text-ink-secondary">
                        {row.target.label}
                      </span>
                    )}
                    <span className="flex items-center gap-2 font-mono text-meta-sm text-ink-secondary">
                      <span className="uppercase">{row.target.type}</span>
                      {row.passwordProtected && (
                        <span
                          className="inline-flex items-center gap-1"
                          title="Password protected"
                        >
                          <LockIcon size={12} />
                          password
                        </span>
                      )}
                      {!row.allowDownload && <span>view only</span>}
                    </span>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <Badge tone={statusTone[row.status]}>{row.status}</Badge>
                </td>

                <td className="px-4 py-3">
                  <span className="font-mono text-meta-sm text-ink-secondary">
                    {formatDate(row.expiresAt)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="font-mono text-meta-sm text-ink-secondary">
                    {row.accessCount}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="text-meta text-ink-secondary">{row.createdBy}</span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {row.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => copy(row.url)}
                      >
                        Copy link
                      </Button>
                    )}
                    {canRevoke(row) && (
                      <Button
                        variant="ghost"
                        size="compact"
                        className="text-error hover:bg-error/10"
                        onClick={() => setRevoking(row)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) revoke(revoking)
        }}
        title="Revoke this link?"
        // Recipients can't tell revocation from expiry — worth stating so the
        // person revoking knows what the recipient will see.
        description="It stops working immediately. Anyone who opens it sees the same message as an expired link, so they won't know it was revoked."
        confirmLabel="Revoke link"
        loading={pending}
      />
    </>
  )
}
