import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import type { Asset, Organization, ShareLink } from '@/types/database'

/**
 * Share-link tokens and resolution.
 *
 * Not listed in the file layout in 02-technical-architecture.md — added because
 * both the authenticated Shares dashboard and the public portal need this logic,
 * and duplicating token validation across a trust boundary is exactly the kind of
 * thing that drifts.
 *
 * Tokens carry an HMAC (keyed by SHARE_LINK_SIGNING_SECRET) so a malformed or
 * forged token is rejected before any database lookup. The random component is
 * still the real secret; the signature just makes probing cheap to refuse.
 */

const TOKEN_BYTES = 24
const SIG_LENGTH = 16

function sign(payload: string): string {
  return createHmac('sha256', env.shareLinkSigningSecret)
    .update(payload)
    .digest('base64url')
    .slice(0, SIG_LENGTH)
}

export function createShareToken(): string {
  const payload = randomBytes(TOKEN_BYTES).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Cheap structural check — no database access. */
export function isWellFormedToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  if (!payload || signature.length !== SIG_LENGTH) return false
  try {
    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function shareUrl(token: string): string {
  return `${env.appUrl}/share/${token}`
}

/* ------------------------------- passwords -------------------------------- */

export async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifySharePassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

/* ------------------------------ rate limiting ------------------------------ */

/**
 * Failed password attempts per token: 5 strikes, then a 60-second cooldown
 * (03-security-access.md).
 *
 * KNOWN LIMITATION: in-process memory, so the counter is per serverless instance
 * and resets on cold start. Adequate for MVP scale; a durable store (a Postgres
 * table or Upstash) is the correct fix before this sees real traffic. Flagged in
 * memory.md.
 */
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 60_000
const attempts = new Map<string, { count: number; blockedUntil: number }>()

export function getCooldownRemainingMs(token: string): number {
  const entry = attempts.get(token)
  if (!entry) return 0
  const remaining = entry.blockedUntil - Date.now()
  return remaining > 0 ? remaining : 0
}

export function recordFailedAttempt(token: string): number {
  const entry = attempts.get(token) ?? { count: 0, blockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + COOLDOWN_MS
    entry.count = 0
  }
  attempts.set(token, entry)
  return getCooldownRemainingMs(token)
}

export function clearAttempts(token: string): void {
  attempts.delete(token)
}

/* ------------------------------- resolution ------------------------------- */

export type ShareResolution =
  | { status: 'invalid' }
  /** Expired and revoked are deliberately indistinguishable to recipients. */
  | { status: 'expired'; organizationName: string | null }
  | { status: 'password_required'; link: ShareLink; organization: Organization }
  | {
      status: 'ok'
      link: ShareLink
      organization: Organization
      assets: Asset[]
      targetLabel: string
    }

/**
 * Resolves a share token via the service-role client, in a narrowly scoped
 * server-side path: validates the token, checks expires_at and revoked_at, and
 * returns only the referenced asset/folder/collection. Never a general query
 * surface (03-security-access.md).
 *
 * The caller must have already verified any password before passing
 * `passwordVerified: true`.
 */
export async function resolveShareLink(
  token: string,
  options: { passwordVerified?: boolean } = {}
): Promise<ShareResolution> {
  if (!isWellFormedToken(token)) return { status: 'invalid' }

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!link) return { status: 'invalid' }

  const { data: organization } = await admin
    .from('organizations')
    .select('*')
    .eq('id', link.organization_id)
    .maybeSingle()

  const isExpired = new Date(link.expires_at).getTime() <= Date.now()
  const isRevoked = link.revoked_at !== null

  if (isExpired || isRevoked) {
    return { status: 'expired', organizationName: organization?.name ?? null }
  }

  if (!organization) return { status: 'invalid' }

  if (link.password_hash && !options.passwordVerified) {
    return { status: 'password_required', link, organization }
  }

  // Load exactly the shared scope — nothing wider.
  let assets: Asset[] = []
  let targetLabel = ''

  if (link.asset_id) {
    const { data } = await admin
      .from('assets')
      .select('*')
      .eq('id', link.asset_id)
      .eq('status', 'active')
    assets = data ?? []
    targetLabel = assets[0]?.filename ?? 'Shared asset'
  } else if (link.folder_id) {
    const { data: folder } = await admin
      .from('folders')
      .select('name')
      .eq('id', link.folder_id)
      .maybeSingle()
    const { data } = await admin
      .from('assets')
      .select('*')
      .eq('folder_id', link.folder_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    assets = data ?? []
    targetLabel = folder?.name ?? 'Shared folder'
  } else if (link.collection_id) {
    const { data: collection } = await admin
      .from('collections')
      .select('name')
      .eq('id', link.collection_id)
      .maybeSingle()
    const { data } = await admin
      .from('collection_assets')
      .select('assets (*)')
      .eq('collection_id', link.collection_id)
    assets = ((data ?? [])
      .map((row) => (row as unknown as { assets: Asset | null }).assets)
      .filter((a): a is Asset => a !== null && a.status === 'active'))
    targetLabel = collection?.name ?? 'Shared collection'
  }

  return { status: 'ok', link, organization, assets, targetLabel }
}

/** Increments the view counter. Failures here must never block the portal. */
export async function recordShareAccess(linkId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('share_links')
      .select('access_count')
      .eq('id', linkId)
      .maybeSingle()
    await admin
      .from('share_links')
      .update({ access_count: (data?.access_count ?? 0) + 1 })
      .eq('id', linkId)
  } catch (err) {
    console.error('[recordShareAccess]', err)
  }
}

/** Derived status shown in the Shares dashboard. */
export function shareLinkStatus(link: {
  expires_at: string
  revoked_at: string | null
}): 'active' | 'expired' | 'revoked' {
  if (link.revoked_at) return 'revoked'
  return new Date(link.expires_at).getTime() <= Date.now() ? 'expired' : 'active'
}
