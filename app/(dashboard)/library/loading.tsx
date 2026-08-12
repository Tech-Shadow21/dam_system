import { AssetGridSkeleton, FolderGridSkeleton, Skeleton } from '@/components/ui/Skeleton'

/** Shapes match the real library layout, not a generic spinner (TICKET-019). */
export default function LibraryLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-10 w-[220px]" />
        <Skeleton className="mt-3 h-4 w-[280px]" />
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="hidden w-[240px] shrink-0 lg:block">
          <Skeleton className="mb-3 h-3 w-[80px]" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-8">
            <FolderGridSkeleton />
          </div>
          <AssetGridSkeleton />
        </div>
      </div>
    </div>
  )
}
