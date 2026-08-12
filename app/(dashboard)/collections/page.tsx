import Link from 'next/link'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getCollections } from '@/lib/queries'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { CollectionIcon } from '@/components/ui/Icon'
import { CollectionActions } from './CollectionActions'

export const metadata: Metadata = { title: 'Collections — Vaultra' }

/** Collections index (TICKET-014). */
export default async function CollectionsPage() {
  const { profile } = await requireSession()
  const collections = await getCollections()
  const canManage = can(profile.role, 'collection:manage')

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Saved groupings of assets that don't require moving files out of their folders."
        actions={canManage ? <CollectionActions mode="create" /> : null}
      />

      {collections.length === 0 ? (
        <EmptyState
          icon={<CollectionIcon size={22} />}
          title="No collections yet"
          description={
            canManage
              ? 'Create a collection to group related assets — a campaign, a launch kit, a press pack — without changing where the files live.'
              : 'No collections have been created yet.'
          }
          action={canManage ? <CollectionActions mode="create" /> : null}
        />
      ) : (
        <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <li key={collection.id}>
              <div className="flex h-full flex-col rounded-card border border-line bg-surface transition-shadow duration-150 hover:shadow-card">
                <Link
                  href={`/collections/${collection.id}`}
                  className="flex flex-1 flex-col p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-canvas text-ink-secondary"
                    >
                      <CollectionIcon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-heading-sm font-medium text-ink">
                        {collection.name}
                      </span>
                      <span className="block font-mono text-meta-sm text-ink-secondary">
                        {collection.assetCount}{' '}
                        {collection.assetCount === 1 ? 'asset' : 'assets'} · created{' '}
                        {formatDate(collection.created_at)}
                      </span>
                    </span>
                  </span>

                  {collection.description && (
                    <span className="mt-3 line-clamp-2 text-body-sm text-ink-secondary">
                      {collection.description}
                    </span>
                  )}
                </Link>

                {canManage && (
                  <div className="border-t border-line px-4 py-2">
                    <CollectionActions
                      mode="edit"
                      collection={{
                        id: collection.id,
                        name: collection.name,
                        description: collection.description,
                      }}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
