'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TagChip } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { TagAutocomplete } from './TagAutocomplete'
import {
  addTagToAssetsAction,
  removeTagFromAssetAction,
} from '@/app/(dashboard)/library/actions'
import type { Tag } from '@/types/database'

/** Inline add/remove tags on the asset detail view (TICKET-012). */
export function TagEditor({
  assetId,
  assetTags,
  allTags,
  editable,
}: {
  assetId: string
  assetTags: Tag[]
  allTags: Tag[]
  editable: boolean
}) {
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function add(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await addTagToAssetsAction({ assetIds: [assetId], tagName: trimmed })
      if (!result.ok) {
        toast.error(result.error ?? result.errors?.tagName ?? 'Could not add that tag.')
        return
      }
      setValue('')
      router.refresh()
    })
  }

  function remove(tagId: string) {
    startTransition(async () => {
      const result = await removeTagFromAssetAction({ assetId, tagId })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not remove that tag.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {assetTags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {assetTags.map((tag) => (
            <li key={tag.id}>
              <TagChip
                label={tag.name}
                onRemove={editable && !pending ? () => remove(tag.id) : undefined}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-ink-secondary">No tags yet.</p>
      )}

      {editable && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TagAutocomplete
              tags={allTags}
              value={value}
              onChange={setValue}
              onCommit={add}
              exclude={assetTags.map((t) => t.id)}
              label="Add a tag"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => add(value)}
            loading={pending}
            disabled={value.trim().length === 0}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
