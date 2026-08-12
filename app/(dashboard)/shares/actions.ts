'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction, ForbiddenError, getSessionContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createShareToken, hashSharePassword, shareUrl } from '@/lib/share-links'
import { createShareLinkSchema, fieldErrors } from '@/lib/validation/schemas'

/** Share-link Server Actions (TICKET-015). */

export interface ShareResult {
  ok: boolean
  error?: string
  errors?: Record<string, string>
  url?: string
}

function failure(error: unknown): ShareResult {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message }
  console.error('[shares action]', error)
  return { ok: false, error: 'Something went wrong on our end — please try again.' }
}

export async function createShareLinkAction(input: {
  targetType: 'asset' | 'folder' | 'collection'
  targetId: string
  expiresAt: string
  password?: string
  allowDownload: boolean
}): Promise<ShareResult> {
  try {
    const { profile } = await authorizeAction('share_link:create')

    const parsed = createShareLinkSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const { targetType, targetId, expiresAt, password, allowDownload } = parsed.data
    const supabase = createClient()

    // Contributors may only share their own assets, and only assets (not whole
    // folders/collections, which they don't own). RLS enforces this too; failing
    // here produces a clear message instead of a policy violation.
    if (!can(profile.role, 'share_link:manage_any')) {
      if (targetType !== 'asset') {
        throw new ForbiddenError(
          'You can only share assets you uploaded, not whole folders or collections.'
        )
      }
      const { data: asset } = await supabase
        .from('assets')
        .select('uploaded_by')
        .eq('id', targetId)
        .maybeSingle()
      if (!asset || asset.uploaded_by !== profile.id) {
        throw new ForbiddenError('You can only share assets you uploaded.')
      }
    }

    const token = createShareToken()

    const { error } = await supabase.from('share_links').insert({
      organization_id: profile.organization_id,
      token,
      asset_id: targetType === 'asset' ? targetId : null,
      folder_id: targetType === 'folder' ? targetId : null,
      collection_id: targetType === 'collection' ? targetId : null,
      password_hash: password ? await hashSharePassword(password) : null,
      allow_download: allowDownload,
      expires_at: new Date(expiresAt).toISOString(),
      created_by: profile.id,
    })

    if (error) return failure(error)

    revalidatePath('/shares')
    return { ok: true, url: shareUrl(token) }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Revokes a link. Recipients see the same message as a natural expiry, so
 * revocation isn't signalled to them (03-security-access.md).
 */
export async function revokeShareLinkAction(linkId: string): Promise<ShareResult> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()

    // RLS restricts this to links the caller may manage; a zero-row update means
    // the link exists but isn't theirs.
    const { data, error } = await supabase
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId)
      .select('id')

    if (error) return failure(error)
    if (!data || data.length === 0) throw new ForbiddenError()

    revalidatePath('/shares')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteShareLinkAction(linkId: string): Promise<ShareResult> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()
    const { data, error } = await supabase
      .from('share_links')
      .delete()
      .eq('id', linkId)
      .select('id')

    if (error) return failure(error)
    if (!data || data.length === 0) throw new ForbiddenError()

    revalidatePath('/shares')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}
