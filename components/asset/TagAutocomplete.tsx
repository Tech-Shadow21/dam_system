'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Field } from '@/components/ui/Input'
import type { Tag } from '@/types/database'

/**
 * Tag input that autocompletes against existing org tags and otherwise offers to
 * create a new one (TICKET-012).
 */
export function TagAutocomplete({
  tags,
  value,
  onChange,
  onCommit,
  label = 'Add a tag',
  placeholder = 'Type to search or create…',
  autoFocus = false,
  exclude = [],
}: {
  tags: Tag[]
  value: string
  onChange: (value: string) => void
  /** Called on Enter or when a suggestion is chosen. */
  onCommit?: (value: string) => void
  label?: string
  placeholder?: string
  autoFocus?: boolean
  /** Tag ids already attached, filtered out of the suggestions. */
  exclude?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputId = useId()
  const listId = `${inputId}-listbox`

  const excludeSet = useMemo(() => new Set(exclude), [exclude])

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    return tags
      .filter((t) => !excludeSet.has(t.id))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .slice(0, 8)
  }, [tags, value, excludeSet])

  const exactExists = tags.some(
    (t) => t.name.toLowerCase() === value.trim().toLowerCase()
  )
  const canCreate = value.trim().length > 0 && !exactExists

  // The "create" row sits after the matches, so it shares one index space.
  const options = canCreate ? [...matches.map((m) => m.name), value.trim()] : matches.map((m) => m.name)

  function commit(next: string) {
    onChange(next)
    setOpen(false)
    onCommit?.(next)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlighted((h) => Math.min(h + 1, Math.max(options.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = open && options[highlighted] ? options[highlighted] : value.trim()
      if (chosen) commit(chosen)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Field label={label} htmlFor={inputId}>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setHighlighted(0)
          }}
          onFocus={() => setOpen(true)}
          // Delay so a click on an option registers before the list unmounts.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-control border border-line bg-surface px-3 text-body-sm text-ink outline-none transition-colors placeholder:text-ink-secondary focus:border-primary focus:shadow-focus"
        />

        {open && options.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[220px] overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-card"
          >
            {matches.map((tag, index) => (
              <li key={tag.id} role="option" aria-selected={highlighted === index}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => commit(tag.name)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-body-sm transition-colors',
                    highlighted === index ? 'bg-accent-muted text-ink' : 'text-ink hover:bg-canvas'
                  )}
                >
                  <span className="truncate">{tag.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-meta-sm text-ink-secondary">
                    existing
                  </span>
                </button>
              </li>
            ))}

            {canCreate && (
              <li role="option" aria-selected={highlighted === matches.length}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(matches.length)}
                  onClick={() => commit(value.trim())}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-body-sm transition-colors',
                    highlighted === matches.length
                      ? 'bg-accent-muted text-ink'
                      : 'text-ink hover:bg-canvas'
                  )}
                >
                  <span className="truncate">
                    Create <span className="font-medium">{value.trim()}</span>
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-meta-sm text-accent">new</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </Field>
  )
}
