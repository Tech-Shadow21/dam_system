import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { getMetadataFields } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { MetadataFieldsManager } from './MetadataFieldsManager'

export const metadata: Metadata = { title: 'Metadata fields — Vaultra' }

/** Settings > Metadata fields (TICKET-011). */
export default async function MetadataSettingsPage() {
  await requirePermission('metadata_field:manage')
  const fields = await getMetadataFields()

  return (
    <div>
      <PageHeader
        title="Metadata fields"
        description="Define the custom fields that appear on every asset in your organization. Changes apply org-wide immediately."
      />
      <MetadataFieldsManager fields={fields} />
    </div>
  )
}
