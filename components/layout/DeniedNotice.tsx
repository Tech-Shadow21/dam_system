'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

/**
 * Surfaces the toast for a redirect away from a restricted page
 * ("You don't have access to that page." — 03-security-access.md edge cases),
 * then strips the query param so a refresh doesn't repeat it.
 */
export function DeniedNotice({
  denied,
  welcome,
}: {
  denied?: boolean
  welcome?: boolean
}) {
  const { error, success } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current) return
    if (!denied && !welcome) return
    shown.current = true

    if (denied) error("You don't have access to that page.")
    if (welcome) success('Your organization is ready. Start by uploading a few assets.')

    router.replace(pathname)
  }, [denied, welcome, error, success, router, pathname])

  return null
}
