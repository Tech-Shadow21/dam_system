import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  getCollectionAssets,
  getCollections,
  getFolders,
  getTags,
} from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { CollectionIcon } from '@/components/ui/Icon'
import { AssetBrowser } from '@/components/asset/AssetBrowser'
import { buttonClasses } from '@/components/ui/Button'
import { CollectionShareButton } from './CollectionShareButton'

export async function generateMetadata({
  params,
}: {
  params: { collectionId: string }
}): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('collections')
    .select('name')
    .eq('id', params.collectionId)
    .maybeSingle()
  return { title: data ? `${data.name} — Vaultra` : 'Collection — Vaultra' }
}

/** Collection browse view — same grid component as folders (TICKET-014). */
export default async function CollectionPage({
  params,
}: {
  params: { collectionId: string }
}) {
  const { profile } = await requireSession()
  const supabase = createClient()

  const { data: collection } = await supabase
    .from('collections')
    .select('*')
    .eq('id', params.collectionId)
    .maybeSingle()

  if (!collection) notFound()

  const [assets, folders, tags, collections] = await Promise.all([
    getCollectionAssets(collection.id),
    getFolders(),
    getTags(),
    getCollections(),
  ])

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-body-sm text-ink-secondary transition-colors hover:text-primary"
        >
          <CollectionIcon size={16} />
          Collections
        </Link>
      </nav>

      <PageHeader
        title={collection.name}
        description={
          collection.description ??
          `${assets.length} ${assets.length === 1 ? 'asset' : 'assets'} in this collection.`
        }
        actions={
          can(profile.role, 'share_link:manage_any') ? (
            <CollectionShareButton
              collectionId={collection.id}
              collectionName={collection.name}
            />
          ) : null
        }
      />

      <AssetBrowser
        assets={assets}
        folders={folders}
        tags={tags}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        role={profile.role}
        currentUserId={profile.id}
        emptyState={
          <EmptyState
            icon={<CollectionIcon size={22} />}
            title="This collection is empty"
            description="Add assets from the library — select them in the grid, then choose “Add to collection”."
            action={
              <Link href="/library" className={buttonClasses({ variant: 'secondary' })}>
                Browse library
              </Link>
            }
          />
        }
      />
    </div>
  )
}
