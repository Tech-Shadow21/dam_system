'use server'

import { cookies } from 'next/headers'
import {
  SHARE_COOKIE_TTL_SECONDS,
  shareCookieName,
  shareCookieValue,
} from './share-cookie'
import {
  getCooldownRemainingMs,
  isWellFormedToken,
  recordFailedAttempt,
  resolveShareLink,
  verifySharePassword,
  clearAttempts,
} from '@/lib/share-links'

/**
 * Share-portal password gate (TICKET-016).
 *
 * On success a short-lived signed cookie records that this browser cleared the
 * password for this specific token. The cookie is HMAC-signed so it can't be
 * forged, and scoped to the token so clearing one link doesn't unlock another.
 */

export interface SharePasswordState {
  error?: string
  cooldownSeconds?: number
}

export async function verifySharePasswordAction(
  _prev: SharePasswordState,
  formData: FormData
): Promise<SharePasswordState> {
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!isWellFormedToken(token)) {
    return { error: 'This link is no longer valid.' }
  }

  // Cooldown after repeated failures (03-security-access.md).
  const cooldown = getCooldownRemainingMs(token)
  if (cooldown > 0) {
    return {
      error: 'Too many attempts. Please wait before trying again.',
      cooldownSeconds: Math.ceil(cooldown / 1000),
    }
  }

  if (password.length === 0) {
    return { error: 'This field is required' }
  }

  const resolution = await resolveShareLink(token)

  if (resolution.status === 'invalid') {
    return { error: 'This link is no longer valid.' }
  }
  if (resolution.status === 'expired') {
    return { error: 'This link has expired.' }
  }
  // Nothing to unlock.
  if (resolution.status === 'ok') {
    return {}
  }

  const hash = resolution.link.password_hash
  if (!hash || !(await verifySharePassword(password, hash))) {
    const remaining = recordFailedAttempt(token)
    if (remaining > 0) {
      return {
        error: 'Too many attempts. Please wait before trying again.',
        cooldownSeconds: Math.ceil(remaining / 1000),
      }
    }
    return { error: 'Incorrect password.' }
  }

  clearAttempts(token)

  cookies().set(shareCookieName(token), shareCookieValue(token), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SHARE_COOKIE_TTL_SECONDS,
    path: `/share/${token}`,
  })

  return {}
}
