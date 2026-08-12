import { Skeleton } from '@/components/ui/Skeleton'

export default function CollectionsLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-[220px]" />
      <Skeleton className="mt-3 h-4 w-[320px]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] w-full rounded-card" />
        ))}
      </div>
    </div>
  )
}
