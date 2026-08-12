'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ShareIcon } from '@/components/ui/Icon'
import { ShareLinkModal } from '@/components/share/ShareLinkModal'

export function CollectionShareButton({
  collectionId,
  collectionName,
}: {
  collectionId: string
  collectionName: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="hero" onClick={() => setOpen(true)}>
        <ShareIcon size={18} />
        Share collection
      </Button>
      <ShareLinkModal
        open={open}
        onClose={() => setOpen(false)}
        targetType="collection"
        targetId={collectionId}
        targetLabel={collectionName}
      />
    </>
  )
}
