import { Skeleton } from '@/components/atoms/Skeleton';

interface TableGridSkeletonProps {
  /** @default 3 */
  cards?: number;
}

/** Placeholder for the lobby's tables while they load, shaped like the cards. */
export function TableGridSkeleton({ cards = 3 }: TableGridSkeletonProps) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-2xl border border-card-border bg-card p-5 backdrop-blur-xl"
        >
          <Skeleton className="h-8 w-40" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
