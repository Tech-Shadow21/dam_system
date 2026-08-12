import { AssetGridSkeleton, FolderGridSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function HomeLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-[300px]" />
      <Skeleton className="mt-3 h-4 w-[260px]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-card" />
        ))}
      </div>
      <div className="mt-8">
        <FolderGridSkeleton />
      </div>
      <div className="mt-8">
        <AssetGridSkeleton />
      </div>
    </div>
  )
}
