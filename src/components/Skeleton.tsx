interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-700/60 ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonExamCard() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full mt-3" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonDayCard() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-3/4 rounded-lg" />
      </div>
    </div>
  );
}
