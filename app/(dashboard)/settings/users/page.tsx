import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { getOrgUsers } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { UsersManager } from './UsersManager'

export const metadata: Metadata = { title: 'Users — Vaultra' }

/** Settings > Users (TICKET-018). */
export default async function UsersSettingsPage() {
  const { profile } = await requirePermission('user:manage')
  const users = await getOrgUsers()

  const activeOwners = users.filter(
    (u) => u.role === 'owner' && u.status === 'active'
  ).length

  return (
    <div>
      <PageHeader
        title="Users"
        description="Invite team members, set their role, and deactivate access. Role changes take effect on their next request."
      />
      <UsersManager
        users={users}
        currentUserId={profile.id}
        currentUserRole={profile.role}
        activeOwnerCount={activeOwners}
      />
    </div>
  )
}
