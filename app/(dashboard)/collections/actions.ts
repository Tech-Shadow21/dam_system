'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction, ForbiddenError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { collectionSchema, fieldErrors } from '@/lib/validation/schemas'

/** Collections Server Actions (TICKET-014). */

export interface CollectionResult {
  ok: boolean
  error?: string
  errors?: Record<string, string>
  id?: string
}

function failure(error: unknown): CollectionResult {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message }
  console.error('[collections action]', error)
  return { ok: false, error: 'Something went wrong on our end — please try again.' }
}

export async function createCollectionAction(input: {
  name: string
  description?: string | null
}): Promise<CollectionResult> {
  try {
    const { profile } = await authorizeAction('collection:manage')

    const parsed = collectionSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        created_by: profile.id,
      })
      .select('id')
      .single()

    if (error || !data) return failure(error)

    revalidatePath('/collections')
    return { ok: true, id: data.id }
  } catch (err) {
    return failure(err)
  }
}

export async function updateCollectionAction(input: {
  collectionId: string
  name: string
  description?: string | null
}): Promise<CollectionResult> {
  try {
    await authorizeAction('collection:manage')

    const parsed = collectionSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .update({ name: parsed.data.name, description: parsed.data.description ?? null })
      .eq('id', input.collectionId)
      .select('id')

    if (error) return failure(error)
    // RLS scopes updates to collections the caller may manage.
    if (!data || data.length === 0) throw new ForbiddenError()

    revalidatePath('/collections')
    revalidatePath(`/collections/${input.collectionId}`)
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteCollectionAction(
  collectionId: string
): Promise<CollectionResult> {
  try {
    await authorizeAction('collection:manage')

    const supabase = createClient()
    const { data, error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .select('id')

    if (error) return failure(error)
    if (!data || data.length === 0) throw new ForbiddenError()

    revalidatePath('/collections')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Adds assets to a collection. Membership is additive and does not move the
 * asset out of its folder — that separation is the whole point of collections.
 */
export async function addAssetsToCollectionAction(input: {
  collectionId: string
  assetIds: string[]
}): Promise<CollectionResult> {
  try {
    const { profile } = await authorizeAction('collection:manage')

    if (input.assetIds.length === 0) return { ok: true }

    const supabase = createClient()
    const { error } = await supabase.from('collection_assets').upsert(
      input.assetIds.map((assetId) => ({
        collection_id: input.collectionId,
        asset_id: assetId,
        added_by: profile.id,
      })),
      { onConflict: 'collection_id,asset_id', ignoreDuplicates: true }
    )

    if (error) return failure(error)

    revalidatePath('/collections')
    revalidatePath(`/collections/${input.collectionId}`)
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

export async function removeAssetFromCollectionAction(input: {
  collectionId: string
  assetId: string
}): Promise<CollectionResult> {
  try {
    await authorizeAction('collection:manage')

    const supabase = createClient()
    const { error } = await supabase
      .from('collection_assets')
      .delete()
      .eq('collection_id', input.collectionId)
      .eq('asset_id', input.assetId)

    if (error) return failure(error)

    revalidatePath(`/collections/${input.collectionId}`)
    revalidatePath(`/library/asset/${input.assetId}`)
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/** Toggles a single asset's membership, used from the asset detail view. */
export async function setAssetCollectionsAction(input: {
  assetId: string
  collectionIds: string[]
}): Promise<CollectionResult> {
  try {
    const { profile } = await authorizeAction('collection:manage')

    const supabase = createClient()

    const { data: current } = await supabase
      .from('collection_assets')
      .select('collection_id')
      .eq('asset_id', input.assetId)

    const currentIds = new Set((current ?? []).map((r) => r.collection_id))
    const targetIds = new Set(input.collectionIds)

    const toAdd = input.collectionIds.filter((id) => !currentIds.has(id))
    const toRemove = Array.from(currentIds).filter((id) => !targetIds.has(id))

    if (toAdd.length > 0) {
      const { error } = await supabase.from('collection_assets').upsert(
        toAdd.map((collectionId) => ({
          collection_id: collectionId,
          asset_id: input.assetId,
          added_by: profile.id,
        })),
        { onConflict: 'collection_id,asset_id', ignoreDuplicates: true }
      )
      if (error) return failure(error)
    }

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('collection_assets')
        .delete()
        .eq('asset_id', input.assetId)
        .in('collection_id', toRemove)
      if (error) return failure(error)
    }

    revalidatePath('/collections')
    revalidatePath(`/library/asset/${input.assetId}`)
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}
