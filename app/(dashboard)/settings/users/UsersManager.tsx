'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, initials } from '@/lib/utils'
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/permissions'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { FormError, FormSuccess } from '@/components/ui/FormError'
import { useToast } from '@/components/ui/Toast'
import { PlusIcon } from '@/components/ui/Icon'
import {
  changeUserRoleAction,
  inviteUserAction,
  resendInviteAction,
  setUserStatusAction,
} from '../actions'
import type { UserRecord, UserRole, UserStatus } from '@/types/database'

const statusTone: Record<UserStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
  deactivated: 'neutral',
}

export function UsersManager({
  users,
  currentUserId,
  currentUserRole,
  activeOwnerCount,
}: {
  users: UserRecord[]
  currentUserId: string
  currentUserRole: UserRole
  activeOwnerCount: number
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>('contributor')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState<UserRecord | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  function invite() {
    setErrors({})
    setFormError(null)
    setInviteUrl(null)
    startTransition(async () => {
      const result = await inviteUserAction({ email, fullName, role })
      if (!result.ok) {
        if (result.errors) setErrors(result.errors)
        if (result.error) setFormError(result.error)
        return
      }
      setInviteUrl(result.inviteUrl ?? null)
      setEmail('')
      setFullName('')
      toast.success('Invitation created.')
      router.refresh()
    })
  }

  function changeRole(user: UserRecord, nextRole: UserRole) {
    startTransition(async () => {
      const result = await changeUserRoleAction({ userId: user.id, role: nextRole })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not change that role.')
        return
      }
      toast.success(`${user.full_name || user.email} is now ${ROLE_LABELS[nextRole]}.`)
      router.refresh()
    })
  }

  function setStatus(user: UserRecord, status: 'active' | 'deactivated') {
    startTransition(async () => {
      const result = await setUserStatusAction({ userId: user.id, status })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not update that user.')
        return
      }
      setDeactivating(null)
      toast.success(
        status === 'deactivated'
          ? 'User deactivated. Their access ended immediately.'
          : 'User reactivated.'
      )
      router.refresh()
    })
  }

  function resend(user: UserRecord) {
    startTransition(async () => {
      const result = await resendInviteAction(user.id)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not create a new invite link.')
        return
      }
      setInviteUrl(result.inviteUrl ?? null)
      setInviteOpen(true)
      toast.success('New invite link created.')
    })
  }

  async function copyInvite() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Invite link copied.')
    } catch {
      toast.error('Could not copy — select the link and copy manually.')
    }
  }

  /** The last active Owner can't be demoted or deactivated. */
  const isLastOwner = (user: UserRecord) =>
    user.role === 'owner' && user.status === 'active' && activeOwnerCount <= 1

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="hero"
          onClick={() => {
            setInviteUrl(null)
            setErrors({})
            setFormError(null)
            setInviteOpen(true)
          }}
        >
          <PlusIcon size={18} />
          Invite user
        </Button>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">Organization users with role and status</caption>
          <thead>
            <tr className="border-b border-line">
              {['User', 'Role', 'Status', 'Joined', ''].map((heading, i) => (
                <th
                  key={heading || i}
                  scope="col"
                  className="px-4 py-3 font-mono text-meta-sm uppercase tracking-wider text-ink-secondary"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const lastOwner = isLastOwner(user)

              return (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-meta-sm font-medium text-white"
                      >
                        {initials(user.full_name || user.email)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm font-medium text-ink">
                          {user.full_name?.trim() || '—'}
                          {isSelf && (
                            <span className="ml-2 font-mono text-meta-sm text-ink-secondary">
                              you
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-mono text-meta-sm text-ink-secondary">
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {/* Self and last-Owner rows show a static badge: those changes
                        are blocked at the database layer, so offering the control
                        would only produce an error. */}
                    {isSelf || lastOwner ? (
                      <div>
                        <Badge tone={user.role === 'owner' ? 'accent' : 'primary'}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                        {lastOwner && (
                          <p className="mt-1 text-meta-sm text-ink-secondary">
                            Last Owner — transfer ownership first
                          </p>
                        )}
                      </div>
                    ) : (
                      <Select
                        aria-label={`Role for ${user.full_name || user.email}`}
                        value={user.role}
                        disabled={pending}
                        onChange={(e) => changeRole(user, e.target.value as UserRole)}
                        className="h-8 text-meta"
                      >
                        {/* Only an Owner can grant Owner. */}
                        {(currentUserRole === 'owner'
                          ? (['owner', ...ASSIGNABLE_ROLES] satisfies UserRole[])
                          : ([...ASSIGNABLE_ROLES] satisfies UserRole[])
                        ).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Badge tone={statusTone[user.status]}>{user.status}</Badge>
                  </td>

                  <td className="px-4 py-3">
                    <span className="font-mono text-meta-sm text-ink-secondary">
                      {formatDate(user.created_at)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {user.status === 'invited' && (
                        <Button
                          variant="ghost"
                          size="compact"
                          onClick={() => resend(user)}
                          disabled={pending}
                        >
                          Resend invite
                        </Button>
                      )}
                      {user.status === 'deactivated' && (
                        <Button
                          variant="ghost"
                          size="compact"
                          onClick={() => setStatus(user, 'active')}
                          disabled={pending}
                        >
                          Reactivate
                        </Button>
                      )}
                      {user.status !== 'deactivated' && !isSelf && !lastOwner && (
                        <Button
                          variant="ghost"
                          size="compact"
                          className="text-error hover:bg-error/10"
                          onClick={() => setDeactivating(user)}
                          disabled={pending}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invite */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={inviteUrl ? 'Invitation ready' : 'Invite a user'}
        description={
          inviteUrl
            ? 'Send this link to the person you invited. It is single-use and time-limited.'
            : 'They will set their own password. Their role is fixed at invite time.'
        }
        dismissable={!pending}
        footer={
          inviteUrl ? (
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                Done
              </Button>
              <Button variant="hero" onClick={copyInvite}>
                Copy invite link
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setInviteOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button variant="hero" onClick={invite} loading={pending}>
                Create invitation
              </Button>
            </>
          )
        }
      >
        {inviteUrl ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-control border border-line bg-canvas p-3">
              <p className="break-all font-mono text-meta text-ink">{inviteUrl}</p>
            </div>
            {/* Honest about the delivery gap: no transactional email provider is
                configured, so the admin shares the link directly. */}
            <FormSuccess message="Vaultra doesn't send invitation emails yet — share this link with the recipient directly." />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <FormError message={formError} />

            <Input
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
              autoFocus
              placeholder="colleague@company.com"
            />
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              hint="Optional — they can set this themselves."
            />
            <Select
              label="Role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as (typeof ASSIGNABLE_ROLES)[number])
              }
              error={errors.role}
              hint={ROLE_DESCRIPTIONS[role]}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => {
          if (deactivating) setStatus(deactivating, 'deactivated')
        }}
        title={`Deactivate ${deactivating?.full_name?.trim() || deactivating?.email || ''}?`}
        description="Their session ends immediately and they lose all access. Assets they uploaded are kept, and you can reactivate them later."
        confirmLabel="Deactivate"
        loading={pending}
      />
    </div>
  )
}
