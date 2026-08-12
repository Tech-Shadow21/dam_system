import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { SettingsNav } from './SettingsNav'

/**
 * Settings shell. Content is capped at 720px per the layout rules, with a
 * sub-navigation listing only the sections the caller's role can reach.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireSession()

  const sections = [
    { href: '/settings/organization', label: 'Organization', visible: can(profile.role, 'org:update') },
    { href: '/settings/branding', label: 'Branding', visible: can(profile.role, 'org:update') },
    {
      href: '/settings/metadata',
      label: 'Metadata fields',
      visible: can(profile.role, 'metadata_field:manage'),
    },
    { href: '/settings/users', label: 'Users', visible: can(profile.role, 'user:manage') },
  ].filter((s) => s.visible)

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {sections.length > 1 && (
        <div className="w-full shrink-0 lg:w-[200px]">
          <SettingsNav sections={sections} />
        </div>
      )}
      <div className="min-w-0 max-w-content flex-1">{children}</div>
    </div>
  )
}
