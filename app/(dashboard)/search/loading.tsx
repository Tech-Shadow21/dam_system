import { AssetGridSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function SearchLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-[180px]" />
      <Skeleton className="mt-3 h-4 w-[340px]" />
      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        <Skeleton className="h-[520px] w-full shrink-0 rounded-card lg:w-[280px]" />
        <div className="min-w-0 flex-1">
          <AssetGridSkeleton />
        </div>
      </div>
    </div>
  )
}
