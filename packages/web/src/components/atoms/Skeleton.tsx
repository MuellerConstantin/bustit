import { twMerge } from 'tailwind-merge';

interface SkeletonProps {
  /** Sets the size and shape of the placeholder, e.g. `h-4 w-32`. */
  className?: string;
}

/** Stands in for content that is still loading. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={twMerge('block animate-pulse rounded-md bg-muted', className)}
    />
  );
}
