import type { UserRole } from '@/types/database'

/**
 * Role → permission mapping for the UI layer.
 *
 * This MUST stay in lockstep with public.has_permission() in
 * supabase/migrations/0002_rls_policies.sql. The database is the real boundary;
 * this copy exists only so the UI can hide controls a user cannot use
 * (03-security-access.md: "Action is hidden/disabled in the UI where possible").
 * Never treat a check here as sufficient on its own.
 */
export type Permission =
  | 'asset:create'
  | 'asset:update_any'
  | 'asset:update_own'
  | 'asset:delete_any'
  | 'asset:delete_own'
  | 'folder:manage'
  | 'collection:manage'
  | 'tag:manage'
  | 'asset_tag:write_any'
  | 'asset_tag:write_own'
  | 'metadata_field:manage'
  | 'share_link:create'
  | 'share_link:manage_any'
  | 'share_link:manage_own'
  | 'user:manage'
  | 'org:update'
  | 'org:delete'
  | 'billing:manage'

const ALL: UserRole[] = ['owner', 'admin', 'manager', 'contributor', 'viewer']
const CONTRIBUTOR_UP: UserRole[] = ['owner', 'admin', 'manager', 'contributor']
const MANAGER_UP: UserRole[] = ['owner', 'admin', 'manager']
const ADMIN_UP: UserRole[] = ['owner', 'admin']
const OWNER_ONLY: UserRole[] = ['owner']

const PERMISSIONS: Record<Permission, UserRole[]> = {
  'asset:create': CONTRIBUTOR_UP,
  'asset:update_any': MANAGER_UP,
  'asset:update_own': CONTRIBUTOR_UP,
  'asset:delete_any': MANAGER_UP,
  'asset:delete_own': CONTRIBUTOR_UP,
  'folder:manage': MANAGER_UP,
  'collection:manage': CONTRIBUTOR_UP,
  'tag:manage': MANAGER_UP,
  'asset_tag:write_any': MANAGER_UP,
  'asset_tag:write_own': CONTRIBUTOR_UP,
  'metadata_field:manage': MANAGER_UP,
  'share_link:create': CONTRIBUTOR_UP,
  'share_link:manage_any': MANAGER_UP,
  'share_link:manage_own': CONTRIBUTOR_UP,
  'user:manage': ADMIN_UP,
  'org:update': ADMIN_UP,
  'org:delete': OWNER_ONLY,
  'billing:manage': OWNER_ONLY,
}

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS[permission]?.includes(role) ?? false
}

/**
 * Whether `role` may act on a specific record, honouring the `_own` split.
 * Used for per-asset controls (edit/delete/replace on the detail view).
 */
export function canActOn(
  role: UserRole | null | undefined,
  action: 'update' | 'delete' | 'tag',
  ownerId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  if (!role) return false
  const map = {
    update: ['asset:update_any', 'asset:update_own'],
    delete: ['asset:delete_any', 'asset:delete_own'],
    tag: ['asset_tag:write_any', 'asset_tag:write_own'],
  } as const
  const [anyPerm, ownPerm] = map[action]
  if (can(role, anyPerm)) return true
  return can(role, ownPerm) && !!ownerId && ownerId === currentUserId
}

/**
 * Roles an admin may assign. Owner is excluded — granting it is an ownership
 * transfer, which only an Owner can perform.
 *
 * Declared `as const` so the element type stays narrow; typing it `UserRole[]`
 * would widen it back to include 'owner' and defeat the point.
 */
export const ASSIGNABLE_ROLES = ['admin', 'manager', 'contributor', 'viewer'] as const

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  contributor: 'Contributor',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Full control, including billing and organization deletion.',
  admin: 'Manages users, assets and branding org-wide.',
  manager: 'Manages assets, folders, tags and share links.',
  contributor: 'Uploads assets and manages their own uploads.',
  viewer: 'Views and downloads assets only.',
}

/** Nav visibility, so restricted destinations never render for the wrong role. */
export function canAccessRoute(role: UserRole | null | undefined, pathname: string): boolean {
  if (!role) return false
  if (pathname.startsWith('/settings/users')) return can(role, 'user:manage')
  if (pathname.startsWith('/settings/branding')) return can(role, 'org:update')
  if (pathname.startsWith('/settings/organization')) return can(role, 'org:update')
  if (pathname.startsWith('/settings/metadata')) return can(role, 'metadata_field:manage')
  if (pathname.startsWith('/shares')) return can(role, 'share_link:create')
  return true
}
