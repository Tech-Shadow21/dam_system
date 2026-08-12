import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function SharesLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-[180px]" />
      <Skeleton className="mt-3 h-4 w-[360px]" />
      <div className="mt-6">
        <ListSkeleton rows={5} />
      </div>
    </div>
  )
}
