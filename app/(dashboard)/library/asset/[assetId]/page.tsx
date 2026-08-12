import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth'
import { canActOn } from '@/lib/permissions'
import {
  getAsset,
  getAssetCollectionIds,
  getAssetVersions,
  getCollections,
  getFolderPath,
  getMetadataFields,
  getTags,
} from '@/lib/queries'
import { signedUrl, variantObjectPath } from '@/lib/storage/client'
import { assetKind, formatDateTime, formatFileSize } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { FolderBreadcrumb } from '@/components/folder/FolderBreadcrumb'
import { AssetPreview } from '@/components/asset/AssetPreview'
import { MetadataPanel } from '@/components/asset/MetadataPanel'
import { TagEditor } from '@/components/asset/TagEditor'
import { VersionHistory } from '@/components/asset/VersionHistory'
import { AssetActions } from './AssetActions'

export async function generateMetadata({
  params,
}: {
  params: { assetId: string }
}): Promise<Metadata> {
  const asset = await getAsset(params.assetId)
  return { title: asset ? `${asset.filename} — Vaultra` : 'Asset — Vaultra' }
}

/** Asset detail view (TICKET-009, TICKET-010, TICKET-011, TICKET-012). */
export default async function AssetDetailPage({
  params,
}: {
  params: { assetId: string }
}) {
  const { profile } = await requireSession()

  const asset = await getAsset(params.assetId)
  if (!asset || asset.status === 'deleted') notFound()

  const [path, versions, allTags, metadataFields, collections, assetCollectionIds] =
    await Promise.all([
      getFolderPath(asset.folder_id),
      getAssetVersions(asset.id),
      getTags(),
      getMetadataFields(),
      getCollections(),
      getAssetCollectionIds(asset.id),
    ])

  const kind = assetKind(asset.file_type)

  /**
   * Images preview from the sharp-generated `preview` variant (smaller, faster).
   * Video and PDF have no generated variant, so they stream from the original.
   */
  const previewUrl =
    kind === 'image'
      ? ((await signedUrl(
          variantObjectPath({
            organizationId: asset.organization_id,
            assetId: asset.id,
            variant: 'preview',
          }),
          3600
        )) ?? (await signedUrl(asset.r2_key, 3600)))
      : kind === 'video' || kind === 'pdf'
        ? await signedUrl(asset.r2_key, 3600)
        : null

  const canEdit = canActOn(profile.role, 'update', asset.uploaded_by, profile.id)
  const canDelete = canActOn(profile.role, 'delete', asset.uploaded_by, profile.id)
  const canTag = canActOn(profile.role, 'tag', asset.uploaded_by, profile.id)

  return (
    <div>
      <FolderBreadcrumb path={path} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-all font-display text-display font-medium text-ink">
            {asset.filename}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-meta text-ink-secondary">
            <span className="uppercase">{kind}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(asset.file_size_bytes)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(asset.created_at)}</span>
            {asset.current_version > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <Badge tone="neutral" mono>
                  v{asset.current_version}
                </Badge>
              </>
            )}
          </p>
        </div>

        <AssetActions
          assetId={asset.id}
          filename={asset.filename}
          canEdit={canEdit}
          canDelete={canDelete}
          role={profile.role}
          uploadedBy={asset.uploaded_by}
          currentUserId={profile.id}
          collections={collections.map((c) => ({ id: c.id, name: c.name }))}
          assetCollectionIds={assetCollectionIds}
          folderId={asset.folder_id}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <AssetPreview
            filename={asset.filename}
            fileType={asset.file_type}
            previewUrl={previewUrl}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardBody>
              <TagEditor
                assetId={asset.id}
                assetTags={asset.tags}
                allTags={allTags}
                editable={canTag}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardBody>
              <MetadataPanel
                assetId={asset.id}
                fields={metadataFields}
                values={asset.metadata}
                editable={canEdit}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3">
                <Detail label="Uploaded by">
                  {asset.uploader?.full_name?.trim() || asset.uploader?.email || 'Unknown'}
                </Detail>
                <Detail label="Folder">
                  {asset.folder_id ? (
                    <Link
                      href={`/library/${asset.folder_id}`}
                      className="text-primary underline decoration-accent decoration-2 underline-offset-2 hover:text-accent"
                    >
                      {path[path.length - 1]?.name ?? 'Folder'}
                    </Link>
                  ) : (
                    'Unfiled'
                  )}
                </Detail>
                <Detail label="File type" mono>
                  {asset.file_type}
                </Detail>
                <Detail label="Storage path" mono>
                  <span className="break-all">{asset.r2_key}</span>
                </Detail>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
            </CardHeader>
            <CardBody>
              <VersionHistory
                assetId={asset.id}
                versions={versions.map((v) => ({
                  id: v.id,
                  version_number: v.version_number,
                  file_size_bytes: Number(v.file_size_bytes),
                  created_at: v.created_at,
                  uploader: (v as unknown as { uploader?: { full_name: string | null; email: string } | null }).uploader ?? null,
                }))}
                currentVersion={asset.current_version}
                canRestore={canEdit}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Detail({
  label,
  children,
  mono = false,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-meta font-medium text-ink-secondary">{label}</dt>
      <dd className={mono ? 'mt-1 font-mono text-meta-sm text-ink' : 'mt-1 text-body-sm text-ink'}>
        {children}
      </dd>
    </div>
  )
}
