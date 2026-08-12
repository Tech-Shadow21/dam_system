import type { Metadata } from 'next'
import { hasSupabaseCredentials } from '@/lib/env'
import { signedUrl, variantObjectPath } from '@/lib/storage/client'
import { recordShareAccess, resolveShareLink } from '@/lib/share-links'
import { assetKind } from '@/lib/utils'
import { BrandedPortalShell } from '@/components/share/BrandedPortalShell'
import { SetupNotice } from '@/components/ui/SetupNotice'
import { hasUnlockedCookie } from './share-cookie'
import { SharePasswordForm } from './SharePasswordForm'
import { SharePortalContent, type PortalAsset } from './SharePortalContent'

export const metadata: Metadata = {
  title: 'Shared assets',
  // Share links must never be indexed.
  robots: { index: false, follow: false },
}

/**
 * Always render fresh. Expiry, revocation and the password gate are all
 * evaluated per request — a cached portal page would keep serving a revoked link.
 */
export const dynamic = 'force-dynamic'

/**
 * Public, unauthenticated share portal (TICKET-016).
 *
 * All validation happens server-side through resolveShareLink(), which uses the
 * service-role client in a narrowly scoped path. Nothing here queries with the
 * anon key, and no visitor ever gets direct bucket access — every asset URL is a
 * short-lived signed URL minted only after the token, expiry, revocation and
 * password have all been checked.
 */
export default async function SharePortalPage({
  params,
}: {
  params: { token: string }
}) {
  if (!hasSupabaseCredentials()) {
    return (
      <BrandedPortalShell
        organizationName="Vaultra"
        logoUrl={null}
        primaryColor={null}
        accentColor={null}
      >
        <SetupNotice />
      </BrandedPortalShell>
    )
  }

  const token = params.token
  const unlocked = await hasUnlockedCookie(token)
  const resolution = await resolveShareLink(token, { passwordVerified: unlocked })

  // Unknown or malformed token. Deliberately shown as an unavailable link rather
  // than a 404, so probing reveals nothing about which tokens exist.
  if (resolution.status === 'invalid') {
    return (
      <BrandedPortalShell
        organizationName="Vaultra"
        logoUrl={null}
        primaryColor={null}
        accentColor={null}
      >
        <PortalMessage
          title="This link is no longer available"
          body="Check that you have the full link, or ask the person who shared it to send a new one."
        />
      </BrandedPortalShell>
    )
  }

  // Expired and revoked are intentionally indistinguishable to recipients.
  if (resolution.status === 'expired') {
    const orgName = resolution.organizationName ?? 'the sender'
    return (
      <BrandedPortalShell
        organizationName={resolution.organizationName ?? 'Vaultra'}
        logoUrl={null}
        primaryColor={null}
        accentColor={null}
      >
        <PortalMessage
          title="This link has expired"
          body={`Contact ${orgName} for access.`}
        />
      </BrandedPortalShell>
    )
  }

  const { organization } = resolution
  const logoUrl = organization.logo_url
    ? await signedUrl(organization.logo_url, 3600)
    : null

  if (resolution.status === 'password_required') {
    return (
      <BrandedPortalShell
        organizationName={organization.name}
        logoUrl={logoUrl}
        primaryColor={organization.brand_primary_color}
        accentColor={organization.brand_secondary_color}
      >
        <SharePasswordForm token={token} organizationName={organization.name} />
      </BrandedPortalShell>
    )
  }

  const { link, assets, targetLabel } = resolution

  // The org deleted the underlying asset after sharing it.
  if (assets.length === 0) {
    return (
      <BrandedPortalShell
        organizationName={organization.name}
        logoUrl={logoUrl}
        primaryColor={organization.brand_primary_color}
        accentColor={organization.brand_secondary_color}
      >
        <PortalMessage
          title="This asset is no longer available"
          body={`It may have been removed by ${organization.name}.`}
        />
      </BrandedPortalShell>
    )
  }

  await recordShareAccess(link.id)

  // Sign a preview URL per asset. Downloads route through the portal's own
  // endpoint so allow_download is re-checked server-side on every request.
  const portalAssets: PortalAsset[] = await Promise.all(
    assets.map(async (asset) => {
      const kind = assetKind(asset.file_type)
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

      const thumbnailUrl =
        kind === 'image'
          ? await signedUrl(
              variantObjectPath({
                organizationId: asset.organization_id,
                assetId: asset.id,
                variant: 'thumbnail',
              }),
              3600
            )
          : null

      return {
        id: asset.id,
        filename: asset.filename,
        fileType: asset.file_type,
        fileSizeBytes: Number(asset.file_size_bytes),
        previewUrl,
        thumbnailUrl,
      }
    })
  )

  return (
    <BrandedPortalShell
      organizationName={organization.name}
      logoUrl={logoUrl}
      primaryColor={organization.brand_primary_color}
      accentColor={organization.brand_secondary_color}
      footerNote={`Shared by ${organization.name}. This link expires ${new Date(
        link.expires_at
      ).toLocaleDateString()}.`}
    >
      <SharePortalContent
        token={token}
        targetLabel={targetLabel}
        assets={portalAssets}
        allowDownload={link.allow_download}
        expiresAt={link.expires_at}
      />
    </BrandedPortalShell>
  )
}

function PortalMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-[520px] rounded-card border border-line bg-surface px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-secondary"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7.5V12l3 2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h1 className="font-display text-heading font-medium text-ink">{title}</h1>
      <p className="mt-3 text-body-sm text-ink-secondary">{body}</p>
    </div>
  )
}
