import { AssetGridSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function CollectionLoading() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-[140px]" />
      <Skeleton className="h-10 w-[280px]" />
      <Skeleton className="mt-3 h-4 w-[220px]" />
      <div className="mt-6">
        <AssetGridSkeleton />
      </div>
    </div>
  )
}
