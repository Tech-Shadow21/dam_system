import { NextResponse, type NextRequest } from 'next/server'
import { getSessionContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { signedUrl } from '@/lib/storage/client'

/**
 * Authenticated asset download.
 *
 * Redirects to a short-lived signed Storage URL rather than proxying the bytes,
 * so large downloads don't run through the serverless function. The signed URL is
 * only minted after RLS has confirmed the caller can see the asset at all.
 *
 * `?download=1` forces a save dialog; without it the browser may display inline.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = await getSessionContext()
  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()

  // RLS scopes this to the caller's organization; a foreign id reads as absent.
  const { data: asset } = await supabase
    .from('assets')
    .select('id, filename, r2_key, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!asset || asset.status === 'deleted') {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const forceDownload = request.nextUrl.searchParams.get('download') === '1'

  const url = await signedUrl(asset.r2_key, 300, {
    download: forceDownload ? asset.filename : false,
  })

  if (!url) {
    return NextResponse.json(
      { error: 'Could not prepare the download — please try again.' },
      { status: 502 }
    )
  }

  return NextResponse.redirect(url)
}
