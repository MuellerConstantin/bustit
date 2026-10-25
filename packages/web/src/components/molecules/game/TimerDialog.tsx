import { tv } from 'tailwind-variants';
import type { TimerProgress } from '@/hooks/useTimerProgress';

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/* The ring turns red for the last seconds. */
const URGENT_SECONDS = 5;

export type TitleTone = 'win' | 'lose' | 'push' | 'neutral';

interface TimerDialogProps {
  /** Without a timer, e.g. when the table doesn't wait for anyone, only the title shows. */
  progress: TimerProgress | null;
  /** A word or two below the ring, left out when the table says it by itself. */
  label?: string;
  /** Lettering above the ring, which then shrinks to a small timer under it. */
  title?: { text: string; tone: TitleTone };
}

/*
 * Everything is lettered like a cartoon title card instead of sitting on a
 * panel: a fat outline behind the fill and a hard shadow under it keep it
 * readable on the felt.
 */
const OUTLINED =
  '[-webkit-text-stroke:0.25em_var(--background)] [filter:drop-shadow(0_3px_0_oklch(0_0_0/0.55))] [paint-order:stroke_fill]';

const lettering = tv({
  base: `font-display text-4xl tracking-wider whitespace-nowrap uppercase -rotate-3 @5xl:text-6xl ${OUTLINED}`,
  variants: {
    tone: {
      win: 'text-gold',
      lose: 'text-destructive',
      push: 'text-foreground',
      neutral: 'text-foreground',
    },
  },
});

/**
 * The running timer with a round progress ring that empties as time runs out,
 * or the end of a round as lettering with the timer small below it. Purely
 * visual, screen readers get the status text instead.
 */
export function TimerDialog({ progress, label, title }: TimerDialogProps) {
  const isSmall = title !== undefined;
  // The wait for the next round isn't urgent, so its ring stays calm.
  const isUrgent =
    !isSmall && progress !== null && progress.secondsLeft <= URGENT_SECONDS;

  return (
    <div
      aria-hidden
      className="relative isolate flex flex-col items-center gap-2 px-6 py-4"
    >
      {/* A soft dark glow instead of a panel, so the lettering stands off the felt */}
      <span className="absolute -inset-6 -z-10 bg-[radial-gradient(closest-side,oklch(0_0_0/0.55),transparent)]" />
      {title && (
        <span className={lettering({ tone: title.tone })}>{title.text}</span>
      )}
      {progress && (
        <div className={isSmall ? 'relative size-14' : 'relative size-28'}>
          <svg viewBox="0 0 72 72" className="size-full -rotate-90">
            <circle
              cx="36"
              cy="36"
              r={RADIUS}
              fill="none"
              strokeWidth="11"
              className="stroke-background"
            />
            <circle
              cx="36"
              cy="36"
              r={RADIUS}
              fill="none"
              strokeWidth="6"
              className="stroke-foreground/25"
            />
            <circle
              cx="36"
              cy="36"
              r={RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress.fraction)}
              className={
                isUrgent
                  ? 'stroke-destructive transition-[stroke-dashoffset] duration-100 ease-linear'
                  : 'stroke-gold transition-[stroke-dashoffset] duration-100 ease-linear'
              }
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center font-display tabular-nums ${OUTLINED} ${isSmall ? 'text-xl' : 'text-5xl'}`}
          >
            {progress.secondsLeft}
          </span>
        </div>
      )}
      {label && !isSmall && (
        <span className={`font-display text-2xl tracking-wide ${OUTLINED}`}>
          {label}
        </span>
      )}
    </div>
  );
}
