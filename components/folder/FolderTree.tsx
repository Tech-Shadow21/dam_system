'use client'

import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, FolderIcon } from '@/components/ui/Icon'
import type { Folder } from '@/types/database'

/**
 * Collapsible folder tree for the library sidebar. Built from a flat folder list
 * so only one query is needed regardless of nesting depth.
 */
interface TreeNode {
  folder: Folder
  children: TreeNode[]
}

function buildTree(folders: Folder[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  folders.forEach((f) => nodes.set(f.id, { folder: f, children: [] }))

  const roots: TreeNode[] = []
  for (const node of Array.from(nodes.values())) {
    const parentId = node.folder.parent_folder_id
    const parent = parentId ? nodes.get(parentId) : undefined
    // A folder whose parent is missing (or self-referential) is treated as root
    // so it can never disappear from the tree.
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (list: TreeNode[]) => {
    list.sort((a, b) => a.folder.name.localeCompare(b.folder.name))
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

/** Ancestor ids of the active folder, so its branch starts expanded. */
function ancestorIds(folders: Folder[], activeId: string | null): Set<string> {
  const out = new Set<string>()
  if (!activeId) return out
  const byId = new Map(folders.map((f) => [f.id, f]))
  let current = byId.get(activeId)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    out.add(current.id)
    current = current.parent_folder_id ? byId.get(current.parent_folder_id) : undefined
  }
  return out
}

export function FolderTree({
  folders,
  activeFolderId,
  counts,
}: {
  folders: Folder[]
  activeFolderId: string | null
  counts?: Map<string, number>
}) {
  const tree = buildTree(folders)
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    ancestorIds(folders, activeFolderId)
  )

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (folders.length === 0) {
    return (
      <p className="px-2 text-meta text-ink-secondary">
        No folders yet.
      </p>
    )
  }

  return (
    <ul role="tree" aria-label="Folders" className="flex flex-col gap-[2px]">
      {tree.map((node) => (
        <TreeItem
          key={node.folder.id}
          node={node}
          depth={0}
          activeFolderId={activeFolderId}
          expanded={expanded}
          onToggle={toggle}
          counts={counts}
        />
      ))}
    </ul>
  )
}

function TreeItem({
  node,
  depth,
  activeFolderId,
  expanded,
  onToggle,
  counts,
}: {
  node: TreeNode
  depth: number
  activeFolderId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  counts?: Map<string, number>
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.folder.id)
  const isActive = activeFolderId === node.folder.id
  const count = counts?.get(node.folder.id)

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      // Required on treeitem: marks the folder currently being browsed.
      aria-selected={isActive}
    >
      <div
        className={cn(
          'group flex items-center gap-1 rounded-control transition-colors',
          isActive ? 'bg-accent-muted' : 'hover:bg-primary/[0.04]'
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.folder.id)}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.folder.name}`}
            className="shrink-0 rounded p-1 text-ink-secondary transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            <ChevronRightIcon
              size={14}
              className={cn('transition-transform', isExpanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden="true" />
        )}

        <Link
          href={`/library/${node.folder.id}`}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-control py-1.5 pr-2 text-body-sm transition-colors',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
            isActive ? 'font-medium text-primary' : 'text-ink hover:text-primary'
          )}
        >
          <FolderIcon
            size={16}
            className={cn('shrink-0', isActive ? 'text-accent' : 'text-ink-secondary')}
          />
          <span className="truncate" title={node.folder.name}>
            {node.folder.name}
          </span>
          {count !== undefined && count > 0 && (
            <span className="ml-auto shrink-0 font-mono text-meta-sm text-ink-secondary">
              {count}
            </span>
          )}
        </Link>
      </div>

      {hasChildren && isExpanded && (
        <ul role="group" className="flex flex-col gap-[2px]">
          {node.children.map((child) => (
            <TreeItem
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              expanded={expanded}
              onToggle={onToggle}
              counts={counts}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
