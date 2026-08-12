import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { shareLinkStatus, shareUrl } from '@/lib/share-links'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShareIcon } from '@/components/ui/Icon'
import { SharesTable, type ShareRow } from './SharesTable'

export const metadata: Metadata = { title: 'Shares — Vaultra' }

/**
 * Shares dashboard (TICKET-015): every link with its derived status, and manual
 * revocation. RLS already limits the rows to links the caller may see; a
 * Contributor sees only their own.
 */
export default async function SharesPage() {
  const { profile } = await requirePermission('share_link:create')
  const supabase = createClient()

  const { data } = await supabase
    .from('share_links')
    .select(
      `*,
       asset:assets ( id, filename ),
       folder:folders ( id, name ),
       collection:collections ( id, name ),
       creator:users!share_links_created_by_fkey ( id, full_name, email )`
    )
    .order('created_at', { ascending: false })

  const rows: ShareRow[] = (data ?? []).map((row) => {
    const r = row as typeof row & {
      asset?: { id: string; filename: string } | null
      folder?: { id: string; name: string } | null
      collection?: { id: string; name: string } | null
      creator?: { id: string; full_name: string | null; email: string } | null
    }

    const target = r.asset
      ? { type: 'asset' as const, label: r.asset.filename, href: `/library/asset/${r.asset.id}` }
      : r.folder
        ? { type: 'folder' as const, label: r.folder.name, href: `/library/${r.folder.id}` }
        : r.collection
          ? {
              type: 'collection' as const,
              label: r.collection.name,
              href: `/collections/${r.collection.id}`,
            }
          : // The DB constraint guarantees exactly one target, but the row may
            // reference something soft-deleted or since removed.
            { type: 'asset' as const, label: 'Unavailable', href: null }

    return {
      id: r.id,
      url: shareUrl(r.token),
      target,
      status: shareLinkStatus(r),
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      allowDownload: r.allow_download,
      passwordProtected: r.password_hash !== null,
      accessCount: r.access_count,
      createdAt: r.created_at,
      createdBy: r.creator?.full_name?.trim() || r.creator?.email || 'Unknown',
      isOwn: r.created_by === profile.id,
    }
  })

  const activeCount = rows.filter((r) => r.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Shares"
        description={
          rows.length > 0
            ? `${activeCount} active of ${rows.length} total. Every link carries an expiry and can be revoked at any time.`
            : 'Links you create for assets, folders and collections appear here.'
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShareIcon size={22} />}
          title="No share links yet"
          description="Create one from an asset, folder or collection. You'll set an expiry date, and can optionally require a password or block downloads."
        />
      ) : (
        <SharesTable rows={rows} role={profile.role} />
      )}
    </div>
  )
}
