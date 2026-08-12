import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { getStorageUsage } from '@/lib/queries'
import { formatDate, formatFileSize } from '@/lib/utils'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { OrganizationForm } from './OrganizationForm'

export const metadata: Metadata = { title: 'Organization — Vaultra' }

/** Settings > Organization: profile plus the storage usage overview. */
export default async function OrganizationSettingsPage() {
  const { organization } = await requirePermission('org:update')
  const usage = await getStorageUsage()

  // Supabase Storage's free tier caps at 1 GB — worth surfacing, since the
  // ceiling is low enough to matter during real use (see memory.md trade-off).
  const FREE_TIER_BYTES = 1024 * 1024 * 1024
  const percentUsed = Math.min(100, Math.round((usage.bytes / FREE_TIER_BYTES) * 100))

  return (
    <div>
      <PageHeader
        title="Organization"
        description="Your organization profile and storage overview."
      />

      <div className="flex flex-col gap-6">
        <OrganizationForm name={organization.name} />

        <Card>
          <CardHeader>
            <CardTitle>Storage</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-meta-sm uppercase tracking-wider text-ink-secondary">
                  Used
                </dt>
                <dd className="mt-1 font-display text-heading-sm font-medium text-ink">
                  {formatFileSize(usage.bytes)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-meta-sm uppercase tracking-wider text-ink-secondary">
                  Assets
                </dt>
                <dd className="mt-1 font-display text-heading-sm font-medium text-ink">
                  {usage.assetCount.toLocaleString()}
                </dd>
              </div>
            </dl>

            <div>
              <div
                className="h-2 overflow-hidden rounded-full border border-ink-secondary bg-line"
                role="progressbar"
                aria-valuenow={percentUsed}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Storage used against the 1 GB free tier"
              >
                <div
                  className={percentUsed > 85 ? 'h-full bg-error' : 'h-full bg-accent'}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <p className="mt-2 text-meta text-ink-secondary">
                {percentUsed}% of the 1 GB Supabase Storage free tier. Upgrading the
                Supabase plan raises this limit.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-meta font-medium text-ink-secondary">Plan</dt>
                <dd className="mt-1 text-body-sm capitalize text-ink">{organization.plan}</dd>
              </div>
              <div>
                <dt className="text-meta font-medium text-ink-secondary">Created</dt>
                <dd className="mt-1 text-body-sm text-ink">
                  {formatDate(organization.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-meta font-medium text-ink-secondary">
                  Organization ID
                </dt>
                <dd className="mt-1 break-all font-mono text-meta-sm text-ink-secondary">
                  {organization.id}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
