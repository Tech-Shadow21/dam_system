import { Skeleton } from '@/components/ui/Skeleton'

export default function SettingsLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-[220px]" />
      <Skeleton className="mt-3 h-4 w-[340px]" />
      <div className="mt-6 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[160px] w-full rounded-card" />
        ))}
      </div>
    </div>
  )
}
