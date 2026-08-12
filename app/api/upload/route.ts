import { NextResponse, type NextRequest } from 'next/server'
import { authorizeAction, ForbiddenError, getSessionContext } from '@/lib/auth'
import { canActOn } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createSignedUpload, objectExists } from '@/lib/storage/upload'
import { generateImageVariants } from '@/lib/storage/thumbnails'
import {
  ACCEPTED_TYPES_LABEL,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/env'
import { isAcceptedMimeType, uploadRequestSchema } from '@/lib/validation/schemas'
import { randomUUID } from 'node:crypto'

/**
 * Upload endpoint (TICKET-007, and the "replace file" path of TICKET-010).
 *
 * Two phases, deliberately:
 *   POST — prepare: validate, mint a signed upload URL. Writes nothing to the DB.
 *   PUT  — complete: confirm the object actually landed in Storage, then create
 *          the assets / asset_versions rows.
 *
 * Splitting them is what makes "partial/corrupt uploads are never marked as a
 * completed asset version" (03-security-access.md) true: an interrupted upload
 * leaves an orphaned object at worst, never a phantom asset row.
 */

/* --------------------------------- prepare -------------------------------- */

export async function POST(request: NextRequest) {
  try {
    const context = await authorizeAction('asset:create')
    const body = await request.json()

    const parsed = uploadRequestSchema.safeParse({
      filename: body.filename,
      fileType: body.fileType,
      fileSizeBytes: Number(body.fileSizeBytes),
      folderId: body.folderId ?? null,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid upload request' },
        { status: 400 }
      )
    }

    const { filename, fileType, fileSizeBytes, folderId } = parsed.data

    // Server-side re-check of the limits the client already enforces.
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 5 GB limit' }, { status: 400 })
    }
    if (!isAcceptedMimeType(fileType)) {
      return NextResponse.json(
        { error: `File type not supported. Accepted types: ${ACCEPTED_TYPES_LABEL}` },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Replacing an existing asset creates the next version rather than a new asset.
    const replaceAssetId: string | undefined = body.replaceAssetId ?? undefined
    let assetId: string
    let versionNumber: number

    if (replaceAssetId) {
      const { data: asset } = await supabase
        .from('assets')
        .select('id, uploaded_by, current_version')
        .eq('id', replaceAssetId)
        .maybeSingle()

      if (!asset) {
        return NextResponse.json({ error: 'That asset no longer exists.' }, { status: 404 })
      }
      if (!canActOn(context.profile.role, 'update', asset.uploaded_by, context.profile.id)) {
        throw new ForbiddenError()
      }
      assetId = asset.id
      versionNumber = asset.current_version + 1
    } else {
      // Generated up front so the object path is known before the row exists.
      assetId = randomUUID()
      versionNumber = 1
    }

    const { data, error } = await createSignedUpload({
      organizationId: context.profile.organization_id,
      assetId,
      versionNumber,
      filename,
    })

    if (error || !data) {
      return NextResponse.json(
        { error: error ?? 'Could not prepare the upload' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      assetId,
      versionNumber,
      folderId: folderId ?? null,
      objectPath: data.objectPath,
      signedUrl: data.signedUrl,
      token: data.token,
    })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error('[upload/prepare]', err)
    return NextResponse.json(
      { error: 'Something went wrong on our end — please try again.' },
      { status: 500 }
    )
  }
}

/* -------------------------------- complete -------------------------------- */

export async function PUT(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: 'Your session has expired.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      assetId,
      objectPath,
      filename,
      fileType,
      fileSizeBytes,
      folderId,
      versionNumber,
      replaceAssetId,
    } = body as {
      assetId: string
      objectPath: string
      filename: string
      fileType: string
      fileSizeBytes: number
      folderId: string | null
      versionNumber: number
      replaceAssetId?: string
    }

    if (!assetId || !objectPath) {
      return NextResponse.json({ error: 'Invalid completion request' }, { status: 400 })
    }

    // The object path embeds the organization; refuse anything outside the
    // caller's own prefix even though storage RLS would also reject it.
    if (!objectPath.startsWith(`org/${context.profile.organization_id}/`)) {
      return NextResponse.json({ error: "You don't have permission to do this" }, { status: 403 })
    }

    // Confirm the bytes are really there before recording a version.
    if (!(await objectExists(objectPath))) {
      return NextResponse.json(
        { error: 'The upload did not complete — please retry.' },
        { status: 409 }
      )
    }

    const supabase = createClient()

    if (replaceAssetId) {
      const { data: asset } = await supabase
        .from('assets')
        .select('id, uploaded_by, organization_id')
        .eq('id', replaceAssetId)
        .maybeSingle()

      if (!asset) {
        return NextResponse.json({ error: 'That asset no longer exists.' }, { status: 404 })
      }
      if (!canActOn(context.profile.role, 'update', asset.uploaded_by, context.profile.id)) {
        return NextResponse.json({ error: "You don't have permission to do this" }, { status: 403 })
      }

      const { error: versionError } = await supabase.from('asset_versions').insert({
        asset_id: replaceAssetId,
        version_number: versionNumber,
        r2_key: objectPath,
        file_size_bytes: fileSizeBytes,
        uploaded_by: context.profile.id,
      })
      if (versionError) throw versionError

      const { error: assetError } = await supabase
        .from('assets')
        .update({
          r2_key: objectPath,
          current_version: versionNumber,
          file_size_bytes: fileSizeBytes,
          file_type: fileType,
          filename,
        })
        .eq('id', replaceAssetId)
      if (assetError) throw assetError

      // Regenerate the thumbnail so the grid reflects the new bytes.
      const variants = await generateImageVariants({
        organizationId: context.profile.organization_id,
        assetId: replaceAssetId,
        objectPath,
        mimeType: fileType,
      })
      if (variants.cdnUrl) {
        await supabase
          .from('assets')
          .update({ cdn_url: variants.cdnUrl })
          .eq('id', replaceAssetId)
      }

      return NextResponse.json({ assetId: replaceAssetId, versionNumber })
    }

    // New asset: create the row, then its initial version.
    const { error: insertError } = await supabase.from('assets').insert({
      id: assetId,
      organization_id: context.profile.organization_id,
      folder_id: folderId ?? null,
      filename,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
      r2_key: objectPath,
      current_version: 1,
      status: 'active',
      uploaded_by: context.profile.id,
      metadata: {},
    })

    if (insertError) throw insertError

    const { error: versionError } = await supabase.from('asset_versions').insert({
      asset_id: assetId,
      version_number: 1,
      r2_key: objectPath,
      file_size_bytes: fileSizeBytes,
      uploaded_by: context.profile.id,
    })

    if (versionError) throw versionError

    // Thumbnail generation is best-effort: the original is already safely stored,
    // and the UI falls back to a file-type icon if no variant exists.
    const variants = await generateImageVariants({
      organizationId: context.profile.organization_id,
      assetId,
      objectPath,
      mimeType: fileType,
    })

    if (variants.cdnUrl) {
      await supabase.from('assets').update({ cdn_url: variants.cdnUrl }).eq('id', assetId)
    }

    return NextResponse.json({ assetId, versionNumber: 1, thumbnail: variants.cdnUrl })
  } catch (err) {
    console.error('[upload/complete]', err)
    return NextResponse.json(
      { error: 'Something went wrong on our end — please try again.' },
      { status: 500 }
    )
  }
}
