import 'server-only'

import { cookies } from 'next/headers'
import { createHmac } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Share-portal unlock cookie.
 *
 * Kept out of actions.ts because a 'use server' module may only export async
 * functions, and these are plain synchronous helpers. Writing the cookie still
 * happens inside the Server Action, which is the only place that's allowed.
 */

export const SHARE_COOKIE_TTL_SECONDS = 60 * 60 * 4

/** Hashed so the raw share token isn't duplicated into a cookie name. */
export function shareCookieName(token: string): string {
  return `vaultra_share_${createHmac('sha256', env.shareLinkSigningSecret)
    .update(token)
    .digest('hex')
    .slice(0, 24)}`
}

/** HMAC-signed value, so an unlock cookie can't be forged by a visitor. */
export function shareCookieValue(token: string): string {
  return createHmac('sha256', env.shareLinkSigningSecret)
    .update(`unlocked:${token}`)
    .digest('base64url')
}

/** True when this browser has already cleared the password for `token`. */
export async function hasUnlockedCookie(token: string): Promise<boolean> {
  try {
    return cookies().get(shareCookieName(token))?.value === shareCookieValue(token)
  } catch {
    // Missing signing secret (unconfigured environment) — treat as locked.
    return false
  }
}
