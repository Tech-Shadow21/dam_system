import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { signedUrl } from '@/lib/storage/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { BrandingForm } from './BrandingForm'

export const metadata: Metadata = { title: 'Branding — Vaultra' }

/** Settings > Branding (TICKET-017). */
export default async function BrandingSettingsPage() {
  const { organization } = await requirePermission('org:update')

  // logo_url stores the Storage object path; the bucket is private, so a signed
  // URL is minted for display.
  const logoPreviewUrl = organization.logo_url
    ? await signedUrl(organization.logo_url, 3600)
    : null

  return (
    <div>
      <PageHeader
        title="Branding"
        description="Your logo and colors appear on the external share portal that recipients see. They don't change the Vaultra dashboard."
      />
      <BrandingForm
        logoPreviewUrl={logoPreviewUrl}
        primaryColor={organization.brand_primary_color}
        secondaryColor={organization.brand_secondary_color}
        organizationName={organization.name}
      />
    </div>
  )
}
