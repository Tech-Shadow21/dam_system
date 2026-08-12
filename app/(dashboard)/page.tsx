import Link from 'next/link'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import {
  getChildFolders,
  getFolderAssetCounts,
  getRecentAssets,
  getStorageUsage,
} from '@/lib/queries'
import { formatFileSize } from '@/lib/utils'
import { AssetGrid } from '@/components/asset/AssetGrid'
import { FolderCard } from '@/components/folder/FolderCard'
import { buttonClasses } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, SectionHeading } from '@/components/ui/PageHeader'
import { LibraryIcon, UploadIcon } from '@/components/ui/Icon'
import { DeniedNotice } from '@/components/layout/DeniedNotice'

export const metadata: Metadata = { title: 'Home — Vaultra' }

/** Dashboard home: recent assets, quick-access folders, storage summary. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: { denied?: string; welcome?: string }
}) {
  const { profile } = await requireSession()

  const [recent, rootFolders, counts, usage] = await Promise.all([
    getRecentAssets(12),
    getChildFolders(null),
    getFolderAssetCounts(),
    getStorageUsage(),
  ])

  const firstName = profile.full_name?.trim().split(/\s+/)[0]

  return (
    <div>
      {/* Toast-equivalent for a redirect from a restricted page. */}
      <DeniedNotice
        denied={searchParams.denied === '1'}
        welcome={searchParams.welcome === '1'}
      />

      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Your organization's archive at a glance."
        actions={
          can(profile.role, 'asset:create') ? (
            <Link href="/library" className={buttonClasses({ variant: 'hero' })}>
              <UploadIcon size={18} />
              Upload assets
            </Link>
          ) : null
        }
      />

      {/* Storage summary — the "storage usage overview" from 01-prd.md. */}
      <dl className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Assets" value={usage.assetCount.toLocaleString()} />
        <Stat label="Storage used" value={formatFileSize(usage.bytes)} />
        <Stat label="Top-level folders" value={rootFolders.length.toLocaleString()} />
      </dl>

      {rootFolders.length > 0 && (
        <section className="mb-8">
          <SectionHeading
            actions={
              <Link
                href="/library"
                className="text-meta font-medium text-primary underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent"
              >
                Browse library
              </Link>
            }
          >
            Quick access
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rootFolders.slice(0, 8).map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                assetCount={counts.get(folder.id) ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading>Recent assets</SectionHeading>
        {recent.length === 0 ? (
          <EmptyState
            icon={<LibraryIcon size={22} />}
            title="Your archive is empty"
            description={
              can(profile.role, 'asset:create')
                ? 'Upload your first assets to start building the library. You can organize them into folders and add tags at any time.'
                : 'No assets have been added yet. Once your team uploads files, they will appear here.'
            }
            action={
              can(profile.role, 'asset:create') ? (
                <Link href="/library" className={buttonClasses({ variant: 'hero' })}>
                  <UploadIcon size={18} />
                  Upload assets
                </Link>
              ) : null
            }
          />
        ) : (
          <AssetGrid assets={recent} role={profile.role} currentUserId={profile.id} />
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="font-mono text-meta-sm uppercase tracking-wider text-ink-secondary">
        {label}
      </dt>
      <dd className="mt-1 font-display text-heading-sm font-medium text-ink">{value}</dd>
    </div>
  )
}
