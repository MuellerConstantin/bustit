import { Skeleton } from '@/components/atoms/Skeleton';

interface InviteListSkeletonProps {
  /** @default 3 */
  rows?: number;
}

/** Placeholder for the invite list while it loads, shaped like its rows. */
export function InviteListSkeleton({ rows = 3 }: InviteListSkeletonProps) {
  return (
    <ul
      aria-hidden
      className="divide-y divide-border rounded-xl border border-border"
    >
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-4 px-4 py-3">
          <div className="w-24 shrink-0">
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72" />
          </div>
        </li>
      ))}
    </ul>
  );
}
