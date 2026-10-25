import { tv } from 'tailwind-variants';
import type { TimerProgress } from '@/hooks/useTimerProgress';

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/* The ring turns red for the last seconds. */
const URGENT_SECONDS = 5;

export type TitleTone = 'gold' | 'red' | 'plain';

export type TimerTitle = { text: string; tone: TitleTone };

interface TimerDialogProps {
  /** Without a timer, e.g. when the table doesn't wait for anyone, only the title shows. */
  progress: TimerProgress | null;
  /** Lettering above the ring, which says what the table waits for or how the round ended. */
  title?: TimerTitle;
  /** A wait that isn't pressing, like the pause until the next round, so the ring never turns red. */
  isCalm?: boolean;
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
      gold: 'text-gold',
      red: 'text-destructive',
      plain: 'text-foreground',
    },
  },
});

/**
 * What the table waits for, as lettering with a round progress ring that
 * empties as time runs out below it. Purely visual, screen readers get the
 * status text instead.
 */
export function TimerDialog({
  progress,
  title,
  isCalm = false,
}: TimerDialogProps) {
  const isUrgent =
    !isCalm && progress !== null && progress.secondsLeft <= URGENT_SECONDS;

  return (
    <div
      aria-hidden
      className="relative isolate flex flex-col items-center gap-5 px-6 py-1"
    >
      {/* A soft dark glow instead of a panel, so the lettering stands off the felt */}
      <span className="absolute -inset-6 -z-10 bg-[radial-gradient(closest-side,oklch(0_0_0/0.55),transparent)]" />
      {title && (
        <span className={lettering({ tone: title.tone })}>{title.text}</span>
      )}
      {progress && (
        <div className="relative size-14">
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
            className={`absolute inset-0 flex items-center justify-center font-display text-xl tabular-nums ${OUTLINED}`}
          >
            {progress.secondsLeft}
          </span>
        </div>
      )}
    </div>
  );
}
