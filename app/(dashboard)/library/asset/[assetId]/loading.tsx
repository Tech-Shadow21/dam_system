import { Skeleton } from '@/components/ui/Skeleton'

export default function AssetDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-[200px]" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-10 w-[320px]" />
          <Skeleton className="mt-3 h-3 w-[240px]" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-[110px]" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="aspect-[4/3] w-full rounded-card" />
        <div className="flex flex-col gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
