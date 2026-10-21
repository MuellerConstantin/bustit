import { twMerge } from 'tailwind-merge';

interface AvatarProps {
  /** Shown by its first letter; without it, the avatar is an empty placeholder. */
  name?: string;
  className?: string;
}

/** Decorative: the name it stands for has to be given next to it. */
export function Avatar({ name, className }: AvatarProps) {
  if (name === undefined) {
    return (
      <span
        aria-hidden
        className={twMerge(
          'block size-8 shrink-0 animate-pulse rounded-full bg-muted',
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={twMerge(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-[url(/images/avatar-chip.svg)] bg-cover text-sm font-semibold text-primary-foreground uppercase select-none',
        className,
      )}
    >
      {/* Slightly larger than the chip's transparent field, so no gap shows at its edge */}
      <span className="flex size-[70%] items-center justify-center rounded-full bg-primary">
        {name.charAt(0)}
      </span>
    </span>
  );
}
