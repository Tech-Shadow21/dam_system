'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction, ForbiddenError, getSessionContext } from '@/lib/auth'
import { canActOn } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeObjects, variantObjectPath } from '@/lib/storage/client'
import {
  createFolderSchema,
  fieldErrors,
  renameFolderSchema,
  tagNameSchema,
} from '@/lib/validation/schemas'
import type { Database, Json } from '@/types/database'

/**
 * Library Server Actions — folders (TICKET-006), asset mutations (TICKET-009),
 * tagging (TICKET-012) and version rollback (TICKET-010). Colocated with the
 * routes that use them, per 02-technical-architecture.md.
 *
 * Every action re-checks permission server-side. RLS is the real boundary, but
 * checking here produces a clear message instead of an opaque database error.
 */

export interface Result {
  ok: boolean
  error?: string
  errors?: Record<string, string>
  /** Populated by actions whose result the caller needs (e.g. new folder id). */
  id?: string
}

function failure(error: unknown): Result {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message }
  console.error('[library action]', error)
  return {
    ok: false,
    error: 'Something went wrong on our end — please try again.',
  }
}

/* ------------------------------- TICKET-006 ------------------------------- */

export async function createFolderAction(input: {
  name: string
  parentFolderId?: string | null
}): Promise<Result> {
  try {
    const { profile } = await authorizeAction('folder:manage')

    const parsed = createFolderSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('folders')
      .insert({
        organization_id: profile.organization_id,
        parent_folder_id: parsed.data.parentFolderId ?? null,
        name: parsed.data.name,
        created_by: profile.id,
      })
      .select('id')
      .single()

    if (error || !data) return failure(error)

    revalidatePath('/library')
    revalidatePath('/')
    return { ok: true, id: data.id }
  } catch (err) {
    return failure(err)
  }
}

export async function renameFolderAction(input: {
  folderId: string
  name: string
}): Promise<Result> {
  try {
    await authorizeAction('folder:manage')

    const parsed = renameFolderSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { error } = await supabase
      .from('folders')
      .update({ name: parsed.data.name })
      .eq('id', parsed.data.folderId)

    if (error) return failure(error)

    revalidatePath('/library')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Deletes a folder. Child folders cascade; assets inside are unfiled rather than
 * destroyed (ON DELETE SET NULL), so a folder delete can never silently lose
 * files. The confirmation modal states this explicitly.
 */
export async function deleteFolderAction(folderId: string): Promise<Result> {
  try {
    await authorizeAction('folder:manage')

    const supabase = createClient()
    const { error } = await supabase.from('folders').delete().eq('id', folderId)
    if (error) return failure(error)

    revalidatePath('/library')
    revalidatePath('/')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------- TICKET-009 ------------------------------- */

/** Renames an asset and/or edits its custom metadata values. */
export async function updateAssetAction(input: {
  assetId: string
  filename?: string
  metadata?: Record<string, string | number | null>
}): Promise<Result> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()
    const { data: asset } = await supabase
      .from('assets')
      .select('id, uploaded_by')
      .eq('id', input.assetId)
      .maybeSingle()

    if (!asset) return { ok: false, error: 'That asset no longer exists.' }
    if (!canActOn(context.profile.role, 'update', asset.uploaded_by, context.profile.id)) {
      throw new ForbiddenError()
    }

    // Typed against the table's Update shape so an unknown column is a build
    // error rather than a silently ignored field.
    const patch: Database['public']['Tables']['assets']['Update'] = {}
    if (input.filename !== undefined) {
      const trimmed = input.filename.trim()
      if (trimmed.length === 0) {
        return { ok: false, errors: { filename: 'This field is required' } }
      }
      patch.filename = trimmed
    }
    if (input.metadata !== undefined) patch.metadata = input.metadata as Json

    if (Object.keys(patch).length === 0) return { ok: true }

    const { error } = await supabase.from('assets').update(patch).eq('id', input.assetId)
    if (error) return failure(error)

    revalidatePath(`/library/asset/${input.assetId}`)
    revalidatePath('/library')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/** Moves assets into a folder (or unfiles them when folderId is null). */
export async function moveAssetsAction(input: {
  assetIds: string[]
  folderId: string | null
}): Promise<Result> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()
    const { data: assets } = await supabase
      .from('assets')
      .select('id, uploaded_by')
      .in('id', input.assetIds)

    const permitted = (assets ?? []).filter((a) =>
      canActOn(context.profile.role, 'update', a.uploaded_by, context.profile.id)
    )

    if (permitted.length === 0) throw new ForbiddenError()

    const { error } = await supabase
      .from('assets')
      .update({ folder_id: input.folderId })
      .in(
        'id',
        permitted.map((a) => a.id)
      )

    if (error) return failure(error)

    revalidatePath('/library')
    revalidatePath('/')

    // Be explicit when a bulk action was partially applied, rather than
    // reporting a clean success.
    const skipped = input.assetIds.length - permitted.length
    if (skipped > 0) {
      return {
        ok: true,
        error: `Moved ${permitted.length}. Skipped ${skipped} you don't have permission to move.`,
      }
    }
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Soft-deletes assets (status = 'deleted'), preserving the row and its version
 * history. Storage objects are removed only for a hard delete, which is not
 * exposed in the MVP UI.
 */
export async function deleteAssetsAction(assetIds: string[]): Promise<Result> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()
    const { data: assets } = await supabase
      .from('assets')
      .select('id, uploaded_by')
      .in('id', assetIds)

    const permitted = (assets ?? []).filter((a) =>
      canActOn(context.profile.role, 'delete', a.uploaded_by, context.profile.id)
    )
    if (permitted.length === 0) throw new ForbiddenError()

    const { error } = await supabase
      .from('assets')
      .update({ status: 'deleted' })
      .in(
        'id',
        permitted.map((a) => a.id)
      )

    if (error) return failure(error)

    revalidatePath('/library')
    revalidatePath('/')

    const skipped = assetIds.length - permitted.length
    if (skipped > 0) {
      return {
        ok: true,
        error: `Deleted ${permitted.length}. Skipped ${skipped} you don't have permission to delete.`,
      }
    }
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------- TICKET-012 ------------------------------- */

/**
 * Attaches a tag to assets, creating the org tag if it doesn't exist yet.
 * Tag names are unique per organization (case-insensitively), so an existing tag
 * is reused rather than duplicated with different casing.
 */
export async function addTagToAssetsAction(input: {
  assetIds: string[]
  tagName: string
}): Promise<Result> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const parsed = tagNameSchema.safeParse(input.tagName)
    if (!parsed.success) return { ok: false, errors: { tagName: parsed.error.issues[0].message } }
    const name = parsed.data

    const supabase = createClient()

    const { data: assets } = await supabase
      .from('assets')
      .select('id, uploaded_by')
      .in('id', input.assetIds)

    const permitted = (assets ?? []).filter((a) =>
      canActOn(context.profile.role, 'tag', a.uploaded_by, context.profile.id)
    )
    if (permitted.length === 0) throw new ForbiddenError()

    // Reuse an existing tag regardless of casing.
    const { data: existing } = await supabase
      .from('tags')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle()

    let tagId = existing?.id
    if (!tagId) {
      const { data: created, error: tagError } = await supabase
        .from('tags')
        .insert({ organization_id: context.profile.organization_id, name })
        .select('id')
        .single()
      if (tagError || !created) return failure(tagError)
      tagId = created.id
    }

    const { error } = await supabase.from('asset_tags').upsert(
      permitted.map((a) => ({ asset_id: a.id, tag_id: tagId as string })),
      { onConflict: 'asset_id,tag_id', ignoreDuplicates: true }
    )

    if (error) return failure(error)

    revalidatePath('/library')
    input.assetIds.forEach((id) => revalidatePath(`/library/asset/${id}`))
    return { ok: true, id: tagId }
  } catch (err) {
    return failure(err)
  }
}

export async function removeTagFromAssetAction(input: {
  assetId: string
  tagId: string
}): Promise<Result> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()
    const { data: asset } = await supabase
      .from('assets')
      .select('id, uploaded_by')
      .eq('id', input.assetId)
      .maybeSingle()

    if (!asset) return { ok: false, error: 'That asset no longer exists.' }
    if (!canActOn(context.profile.role, 'tag', asset.uploaded_by, context.profile.id)) {
      throw new ForbiddenError()
    }

    const { error } = await supabase
      .from('asset_tags')
      .delete()
      .eq('asset_id', input.assetId)
      .eq('tag_id', input.tagId)

    if (error) return failure(error)

    revalidatePath(`/library/asset/${input.assetId}`)
    revalidatePath('/library')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------- TICKET-010 ------------------------------- */

/**
 * Restores a prior version as the current one.
 *
 * Deliberately additive: rather than rewinding current_version (which would
 * discard history), it copies the chosen version's object to a new version
 * number. The audit trail stays append-only, matching the immutability enforced
 * on asset_versions at the database layer.
 */
export async function restoreVersionAction(input: {
  assetId: string
  versionNumber: number
}): Promise<Result> {
  try {
    const context = await getSessionContext()
    if (!context) throw new ForbiddenError('Your session has expired — please sign in again.')

    const supabase = createClient()
    const { data: asset } = await supabase
      .from('assets')
      .select('id, uploaded_by, organization_id, current_version, file_type, filename')
      .eq('id', input.assetId)
      .maybeSingle()

    if (!asset) return { ok: false, error: 'That asset no longer exists.' }
    if (!canActOn(context.profile.role, 'update', asset.uploaded_by, context.profile.id)) {
      throw new ForbiddenError()
    }

    const { data: version } = await supabase
      .from('asset_versions')
      .select('*')
      .eq('asset_id', input.assetId)
      .eq('version_number', input.versionNumber)
      .maybeSingle()

    if (!version) return { ok: false, error: 'That version no longer exists.' }

    const nextVersion = asset.current_version + 1
    const admin = createAdminClient()

    // Copy the stored object to the new version path so each version keeps its
    // own immutable object.
    const newKey = version.r2_key.replace(
      /\/v\d+\//,
      `/v${nextVersion}/`
    )

    const { error: copyError } = await admin.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? 'vaultra-assets')
      .copy(version.r2_key, newKey)

    if (copyError) {
      console.error('[restoreVersion] copy failed', copyError)
      return {
        ok: false,
        error: 'Could not restore that version — the stored file could not be copied.',
      }
    }

    const { error: versionError } = await supabase.from('asset_versions').insert({
      asset_id: input.assetId,
      version_number: nextVersion,
      r2_key: newKey,
      file_size_bytes: version.file_size_bytes,
      uploaded_by: context.profile.id,
    })

    if (versionError) return failure(versionError)

    const { error: assetError } = await supabase
      .from('assets')
      .update({ r2_key: newKey, current_version: nextVersion })
      .eq('id', input.assetId)

    if (assetError) return failure(assetError)

    // The thumbnail now describes the wrong bytes; regenerate from the restored
    // version so the grid doesn't show a stale preview.
    await regenerateThumbnail({
      organizationId: asset.organization_id,
      assetId: asset.id,
      objectPath: newKey,
      mimeType: asset.file_type,
    })

    revalidatePath(`/library/asset/${input.assetId}`)
    revalidatePath('/library')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/** Shared by upload and version restore. */
async function regenerateThumbnail(params: {
  organizationId: string
  assetId: string
  objectPath: string
  mimeType: string
}) {
  const { generateImageVariants } = await import('@/lib/storage/thumbnails')
  const variants = await generateImageVariants(params)
  if (variants.cdnUrl) {
    const supabase = createClient()
    await supabase
      .from('assets')
      .update({ cdn_url: variants.cdnUrl })
      .eq('id', params.assetId)
  }
}

/**
 * Hard-deletes an asset and every stored object belonging to it. Not wired to
 * the MVP UI (delete is a soft delete); kept here so storage cleanup lives
 * alongside the rest of the asset lifecycle.
 */
export async function purgeAssetAction(assetId: string): Promise<Result> {
  try {
    const context = await authorizeAction('asset:delete_any')

    const supabase = createClient()
    const { data: versions } = await supabase
      .from('asset_versions')
      .select('r2_key')
      .eq('asset_id', assetId)

    const paths = [
      ...(versions ?? []).map((v) => v.r2_key),
      variantObjectPath({
        organizationId: context.profile.organization_id,
        assetId,
        variant: 'thumbnail',
      }),
      variantObjectPath({
        organizationId: context.profile.organization_id,
        assetId,
        variant: 'preview',
      }),
    ]

    await removeObjects(paths)

    const { error } = await supabase.from('assets').delete().eq('id', assetId)
    if (error) return failure(error)

    revalidatePath('/library')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}
