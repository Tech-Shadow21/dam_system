'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction, ForbiddenError, getSessionContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { brandingObjectPath } from '@/lib/storage/client'
import { processLogo } from '@/lib/storage/thumbnails'
import { uploadBuffer } from '@/lib/storage/upload'
import { env } from '@/lib/env'
import {
  brandingSchema,
  changeRoleSchema,
  fieldErrors,
  inviteSchema,
  metadataFieldSchema,
  organizationSchema,
  setUserStatusSchema,
} from '@/lib/validation/schemas'
import type { Json } from '@/types/database'

/**
 * Settings Server Actions: metadata fields (TICKET-011), branding (TICKET-017),
 * organization profile, and users/roles (TICKET-018).
 */

export interface SettingsResult {
  ok: boolean
  error?: string
  errors?: Record<string, string>
  /** Copyable invite link, since automated email depends on SMTP config. */
  inviteUrl?: string
}

function failure(error: unknown): SettingsResult {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message }
  console.error('[settings action]', error)
  return { ok: false, error: 'Something went wrong on our end — please try again.' }
}

/* ------------------------- TICKET-011: metadata fields -------------------- */

export async function createMetadataFieldAction(input: {
  fieldKey: string
  label: string
  fieldType: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}): Promise<SettingsResult> {
  try {
    const { profile } = await authorizeAction('metadata_field:manage')

    const parsed = metadataFieldSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { error } = await supabase.from('metadata_fields').insert({
      organization_id: profile.organization_id,
      field_key: parsed.data.fieldKey,
      label: parsed.data.label,
      field_type: parsed.data.fieldType,
      options: parsed.data.fieldType === 'select' ? (parsed.data.options as Json) : null,
    })

    if (error) {
      // 23505 = unique violation on (organization_id, field_key), which is the
      // real guard against duplicate keys.
      if (error.code === '23505') {
        return { ok: false, errors: { fieldKey: 'A field with this key already exists' } }
      }
      return failure(error)
    }

    revalidatePath('/settings/metadata')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function updateMetadataFieldAction(input: {
  fieldId: string
  label: string
  fieldType: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}): Promise<SettingsResult> {
  try {
    await authorizeAction('metadata_field:manage')

    // field_key is intentionally immutable: it's the jsonb key already written
    // into every asset's metadata, so renaming it would orphan existing values.
    const parsed = metadataFieldSchema.safeParse({
      fieldKey: 'placeholder_key',
      label: input.label,
      fieldType: input.fieldType,
      options: input.options,
    })
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error)
      delete errs.fieldKey
      return { ok: false, errors: errs }
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('metadata_fields')
      .update({
        label: input.label.trim(),
        field_type: input.fieldType,
        options: input.fieldType === 'select' ? (input.options as Json) : null,
      })
      .eq('id', input.fieldId)

    if (error) return failure(error)

    revalidatePath('/settings/metadata')
    revalidatePath('/library')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteMetadataFieldAction(fieldId: string): Promise<SettingsResult> {
  try {
    await authorizeAction('metadata_field:manage')

    const supabase = createClient()
    const { error } = await supabase.from('metadata_fields').delete().eq('id', fieldId)
    if (error) return failure(error)

    revalidatePath('/settings/metadata')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/* --------------------------- TICKET-017: branding ------------------------- */

export async function updateBrandingAction(input: {
  brandPrimaryColor?: string | null
  brandSecondaryColor?: string | null
}): Promise<SettingsResult> {
  try {
    const { profile } = await authorizeAction('org:update')

    const parsed = brandingSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({
        brand_primary_color: parsed.data.brandPrimaryColor ?? null,
        brand_secondary_color: parsed.data.brandSecondaryColor ?? null,
      })
      .eq('id', profile.organization_id)

    if (error) return failure(error)

    revalidatePath('/settings/branding')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Uploads and stores the org logo. The image is resized by sharp server-side
 * before it reaches Storage, so a 12 MP original doesn't become the portal logo.
 */
export async function uploadLogoAction(formData: FormData): Promise<SettingsResult> {
  try {
    const { profile } = await authorizeAction('org:update')

    const file = formData.get('logo')
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, errors: { logo: 'Choose an image to upload' } }
    }
    if (!file.type.startsWith('image/')) {
      return { ok: false, errors: { logo: 'The logo must be an image file' } }
    }
    // Generous but bounded: this is a logo, not an asset.
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, errors: { logo: 'The logo must be under 10 MB' } }
    }

    const processed = await processLogo(Buffer.from(await file.arrayBuffer()))
    if (!processed) {
      return { ok: false, errors: { logo: 'That image could not be processed' } }
    }

    const objectPath = brandingObjectPath({
      organizationId: profile.organization_id,
      filename: 'logo.webp',
    })

    const { error: uploadError } = await uploadBuffer({
      objectPath,
      body: processed.body,
      contentType: processed.contentType,
      upsert: true,
    })
    if (uploadError) return { ok: false, error: uploadError }

    // The portal must render the logo without a session, so it needs a durable
    // URL. Signed URLs expire; the portal re-signs on each render instead
    // (see resolveLogoUrl in the share portal). Store the object path form.
    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ logo_url: objectPath })
      .eq('id', profile.organization_id)

    if (error) return failure(error)

    revalidatePath('/settings/branding')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function removeLogoAction(): Promise<SettingsResult> {
  try {
    const { profile } = await authorizeAction('org:update')
    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ logo_url: null })
      .eq('id', profile.organization_id)
    if (error) return failure(error)
    revalidatePath('/settings/branding')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function updateOrganizationAction(input: {
  name: string
}): Promise<SettingsResult> {
  try {
    const { profile } = await authorizeAction('org:update')

    const parsed = organizationSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ name: parsed.data.name })
      .eq('id', profile.organization_id)

    if (error) return failure(error)

    revalidatePath('/settings/organization')
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------ TICKET-018: users & roles ----------------------- */

/**
 * Invites a user.
 *
 * Uses the service-role admin API to create the auth user and generate an invite
 * link. `generateLink` does not send mail — Supabase's built-in SMTP on the free
 * tier is heavily rate-limited, so relying on it for invites would be fragile.
 * The action returns a copyable link instead, and wiring a transactional email
 * provider is a documented next step (memory.md).
 */
export async function inviteUserAction(input: {
  email: string
  fullName?: string
  role: 'admin' | 'manager' | 'contributor' | 'viewer'
}): Promise<SettingsResult> {
  try {
    const { profile } = await authorizeAction('user:manage')

    const parsed = inviteSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
    const { email, fullName, role } = parsed.data

    const supabase = createClient()

    // RLS scopes this read to the caller's org, so this only catches
    // same-organization duplicates — which is what we want to report.
    const { data: existing } = await supabase
      .from('users')
      .select('id, status')
      .ilike('email', email)
      .maybeSingle()

    if (existing) {
      return {
        ok: false,
        errors: { email: 'Someone with this email is already in your organization' },
      }
    }

    const admin = createAdminClient()

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${env.appUrl}/invite/accept` },
    })

    if (linkError || !link.user) {
      const msg = linkError?.message ?? 'Could not create the invitation'
      return {
        ok: false,
        errors: {
          email: /already been registered|already exists/i.test(msg)
            ? 'This email is already registered on Vaultra.'
            : msg,
        },
      }
    }

    // Profile row carries the org membership and the role chosen by the admin.
    const { error: profileError } = await admin.from('users').insert({
      id: link.user.id,
      organization_id: profile.organization_id,
      full_name: fullName ?? '',
      email,
      role,
      status: 'invited',
    })

    if (profileError) {
      // Roll back the auth user so the address can be invited again.
      await admin.auth.admin.deleteUser(link.user.id).catch(() => {})
      return failure(profileError)
    }

    revalidatePath('/settings/users')
    return {
      ok: true,
      inviteUrl: `${env.appUrl}/invite/${link.properties.hashed_token}`,
    }
  } catch (err) {
    return failure(err)
  }
}

export async function changeUserRoleAction(input: {
  userId: string
  role: 'owner' | 'admin' | 'manager' | 'contributor' | 'viewer'
}): Promise<SettingsResult> {
  try {
    const context = await authorizeAction('user:manage')

    const parsed = changeRoleSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    if (parsed.data.userId === context.profile.id) {
      return { ok: false, error: 'You cannot change your own role.' }
    }
    // Only an Owner may hand out Owner (an ownership transfer).
    if (parsed.data.role === 'owner' && context.profile.role !== 'owner') {
      return { ok: false, error: 'Only an Owner can transfer ownership.' }
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .update({ role: parsed.data.role })
      .eq('id', parsed.data.userId)
      .select('id')

    if (error) {
      // The last-owner trigger raises a plain-language message; surface it.
      return { ok: false, error: error.message }
    }
    if (!data || data.length === 0) throw new ForbiddenError()

    revalidatePath('/settings/users')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function setUserStatusAction(input: {
  userId: string
  status: 'active' | 'deactivated'
}): Promise<SettingsResult> {
  try {
    const context = await authorizeAction('user:manage')

    const parsed = setUserStatusSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    if (parsed.data.userId === context.profile.id) {
      return { ok: false, error: 'You cannot deactivate your own account.' }
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.userId)
      .select('id')

    if (error) {
      // Includes the "must always have at least one active Owner" message.
      return { ok: false, error: error.message }
    }
    if (!data || data.length === 0) throw new ForbiddenError()

    // Deactivation must actually end their access, not just flag the row.
    // current_organization_id() already returns NULL for a deactivated user, so
    // RLS closes immediately; revoking refresh tokens ends the session too.
    if (parsed.data.status === 'deactivated') {
      const admin = createAdminClient()
      await admin.auth.admin.signOut(parsed.data.userId, 'global').catch(() => {})
    }

    revalidatePath('/settings/users')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/** Re-issues an invite link for someone still in 'invited' state. */
export async function resendInviteAction(userId: string): Promise<SettingsResult> {
  try {
    await authorizeAction('user:manage')

    const supabase = createClient()
    const { data: user } = await supabase
      .from('users')
      .select('email, status')
      .eq('id', userId)
      .maybeSingle()

    if (!user) throw new ForbiddenError()
    if (user.status !== 'invited') {
      return { ok: false, error: 'That user has already activated their account.' }
    }

    const admin = createAdminClient()
    // 'recovery' works for a user who already exists and lets them set a password.
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: { redirectTo: `${env.appUrl}/invite/accept` },
    })

    if (error || !link) return failure(error)

    return { ok: true, inviteUrl: `${env.appUrl}/invite/${link.properties.hashed_token}` }
  } catch (err) {
    return failure(err)
  }
}
