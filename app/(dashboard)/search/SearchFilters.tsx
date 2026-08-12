'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Checkbox, Input, Select } from '@/components/ui/Input'
import type { Folder, Tag, UserRecord } from '@/types/database'

/**
 * Filter panel (TICKET-013). State lives entirely in the URL query string, so a
 * filtered view is shareable and survives a refresh, and the server component
 * re-runs the query on change.
 */
const FILE_KINDS: { value: string; label: string }[] = [
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Video' },
  { value: 'pdf', label: 'PDF' },
  { value: 'document', label: 'Documents' },
  { value: 'design', label: 'Design files' },
  { value: 'other', label: 'Other' },
]

export function SearchFilters({
  folders,
  tags,
  users,
  collections,
}: {
  folders: Folder[]
  tags: Tag[]
  users: UserRecord[]
  collections: { id: string; name: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const current = useCallback(
    (key: string) => searchParams.get(key) ?? '',
    [searchParams]
  )
  const currentAll = useCallback(
    (key: string) => searchParams.getAll(key),
    [searchParams]
  )

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      router.push(`/search?${params.toString()}`)
    },
    [router, searchParams]
  )

  const setSingle = (key: string, value: string) =>
    update((params) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })

  const toggleMulti = (key: string, value: string, checked: boolean) =>
    update((params) => {
      const existing = params.getAll(key).filter((v) => v !== value)
      params.delete(key)
      const next = checked ? [...existing, value] : existing
      next.forEach((v) => params.append(key, v))
    })

  const activeCount =
    (current('q') ? 1 : 0) +
    (current('folder') ? 1 : 0) +
    (current('uploader') ? 1 : 0) +
    (current('collection') ? 1 : 0) +
    (current('from') || current('to') ? 1 : 0) +
    currentAll('kind').length +
    currentAll('tag').length

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>Filters</CardTitle>
        {activeCount > 0 && (
          <Button variant="ghost" size="compact" onClick={() => router.push('/search')}>
            Clear all
          </Button>
        )}
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        <Input
          label="Keyword"
          type="search"
          defaultValue={current('q')}
          placeholder="Filename, tag or metadata"
          // Commit on blur/Enter rather than per keystroke, to avoid a
          // navigation for every character typed.
          onBlur={(e) => {
            if (e.target.value !== current('q')) setSingle('q', e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSingle('q', (e.target as HTMLInputElement).value)
          }}
        />

        <fieldset>
          <legend className="mb-2 text-meta font-medium text-ink-secondary">File type</legend>
          <div className="flex flex-col gap-2">
            {FILE_KINDS.map((kind) => (
              <Checkbox
                key={kind.value}
                checked={currentAll('kind').includes(kind.value)}
                onChange={(e) => toggleMulti('kind', kind.value, e.target.checked)}
                label={kind.label}
              />
            ))}
          </div>
        </fieldset>

        {tags.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-meta font-medium text-ink-secondary">
              Tags
              <span className="ml-1 font-normal text-ink-secondary/70">
                (all selected must match)
              </span>
            </legend>
            <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto pr-1">
              {tags.map((tag) => (
                <Checkbox
                  key={tag.id}
                  checked={currentAll('tag').includes(tag.id)}
                  onChange={(e) => toggleMulti('tag', tag.id, e.target.checked)}
                  label={tag.name}
                />
              ))}
            </div>
          </fieldset>
        )}

        {folders.length > 0 && (
          <Select
            label="Folder"
            value={current('folder')}
            onChange={(e) => setSingle('folder', e.target.value)}
          >
            <option value="">Any folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </Select>
        )}

        {collections.length > 0 && (
          <Select
            label="Collection"
            value={current('collection')}
            onChange={(e) => setSingle('collection', e.target.value)}
          >
            <option value="">Any collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          label="Uploaded by"
          value={current('uploader')}
          onChange={(e) => setSingle('uploader', e.target.value)}
        >
          <option value="">Anyone</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name?.trim() || user.email}
            </option>
          ))}
        </Select>

        <fieldset>
          <legend className="mb-2 text-meta font-medium text-ink-secondary">
            Date added
          </legend>
          <div className="flex flex-col gap-3">
            <Input
              label="From"
              type="date"
              value={current('from')}
              onChange={(e) => setSingle('from', e.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={current('to')}
              onChange={(e) => setSingle('to', e.target.value)}
            />
          </div>
        </fieldset>
      </CardBody>
    </Card>
  )
}
