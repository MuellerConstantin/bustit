import { twMerge } from 'tailwind-merge';

interface AvatarProps {
  /** Shown by its first letter; without it, the avatar is an empty placeholder. */
  name?: string;
  className?: string;
}

/** Decorative: the name it stands for has to be given next to it. */
export function Avatar({ name, className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={twMerge(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground uppercase select-none',
        name === undefined && 'animate-pulse bg-muted',
        className,
      )}
    >
      {name?.charAt(0)}
    </span>
  );
}
