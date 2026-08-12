import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasSupabaseCredentials } from '@/lib/env'

/**
 * Invite link entry point: /invite/{token_hash}
 *
 * Implemented as a Route Handler rather than a page so the token is exchanged
 * for a session before anything renders. That means an expired or already-used
 * invite shows the correct error state immediately (03-security-access.md),
 * instead of only failing after the user has filled in the form.
 *
 * The token is the `hashed_token` produced by Supabase when the invite was
 * created. verifyOtp consumes it exactly once.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token
  const origin = request.nextUrl.origin

  // Without a live project there is nothing to verify the token against; the
  // expired screen is the honest outcome rather than a 500.
  if (!token || !hasSupabaseCredentials()) {
    return NextResponse.redirect(new URL('/invite/expired', origin))
  }

  const supabase = createClient()

  // An invite that was created with generateLink({type:'invite'}) verifies as
  // 'invite'; a resend issued for an existing user arrives as 'recovery'. Try
  // both so either path lands the user on the same screen.
  for (const type of ['invite', 'recovery'] as const) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type })
    if (!error && data.session) {
      return NextResponse.redirect(new URL('/invite/accept', origin))
    }
  }

  return NextResponse.redirect(new URL('/invite/expired', origin))
}
