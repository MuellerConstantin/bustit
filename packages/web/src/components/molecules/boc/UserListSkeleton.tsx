import { Avatar } from '@/components/atoms/Avatar';
import { Skeleton } from '@/components/atoms/Skeleton';

interface UserListSkeletonProps {
  /** @default 3 */
  rows?: number;
}

/** Placeholder for the user list while it loads, shaped like its rows. */
export function UserListSkeleton({ rows = 3 }: UserListSkeletonProps) {
  return (
    <ul
      aria-hidden
      className="divide-y divide-border rounded-xl border border-border"
    >
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-4 px-4 py-3">
          <Avatar />
          <div className="flex grow flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-4 w-20" />
          <div className="w-8 shrink-0" />
        </li>
      ))}
    </ul>
  );
}
