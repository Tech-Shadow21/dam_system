import { NextResponse, type NextRequest } from 'next/server'
import { resolveShareLink } from '@/lib/share-links'
import { signedUrl } from '@/lib/storage/client'
import { hasUnlockedCookie } from '../../share-cookie'

/**
 * Download endpoint for the public share portal.
 *
 * This is where `allow_download` is enforced. Hiding the button in the UI is
 * presentation only; a recipient who constructs this URL by hand must still be
 * refused (TICKET-016: "Download is disabled on the frontend and blocked
 * server-side when the link doesn't permit it").
 *
 * Every check is re-run per request — token validity, expiry, revocation,
 * password, download permission, and that the asset is actually inside the shared
 * scope — because a link's state can change between page render and download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string; assetId: string } }
) {
  const { token, assetId } = params

  const unlocked = await hasUnlockedCookie(token)
  const resolution = await resolveShareLink(token, { passwordVerified: unlocked })

  if (resolution.status === 'invalid' || resolution.status === 'expired') {
    return NextResponse.json({ error: 'This link is no longer available.' }, { status: 404 })
  }

  // A password-protected link that hasn't been cleared in this browser.
  if (resolution.status === 'password_required') {
    return NextResponse.json({ error: 'Password required.' }, { status: 401 })
  }

  if (!resolution.link.allow_download) {
    return NextResponse.json(
      { error: 'Downloads are not permitted for this link.' },
      { status: 403 }
    )
  }

  // The asset must be within the link's own scope — not merely a valid asset id
  // belonging to the same organization.
  const asset = resolution.assets.find((a) => a.id === assetId)
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found in this share.' }, { status: 404 })
  }

  const url = await signedUrl(asset.r2_key, 300, { download: asset.filename })
  if (!url) {
    return NextResponse.json(
      { error: 'Could not prepare the download — please try again.' },
      { status: 502 }
    )
  }

  return NextResponse.redirect(url)
}
