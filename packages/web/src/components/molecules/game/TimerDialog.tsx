import type { TimerProgress } from '@/hooks/useTimerProgress';

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/* The ring turns red for the last seconds. */
const URGENT_SECONDS = 5;

interface TimerDialogProps {
  progress: TimerProgress;
  /** A word or two below the ring, left out when the table says it by itself. */
  label?: string;
}

/**
 * The running timer as a small dialog with a round progress ring that empties
 * as time runs out. Purely visual, screen readers get the status text instead.
 */
export function TimerDialog({ progress, label }: TimerDialogProps) {
  const isUrgent = progress.secondsLeft <= URGENT_SECONDS;

  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-1 rounded-2xl border border-card-border bg-card px-4 py-3 shadow-2xl backdrop-blur-xl"
    >
      <div className="relative size-18">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90">
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            className="stroke-border"
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
                : 'stroke-primary transition-[stroke-dashoffset] duration-100 ease-linear'
            }
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-3xl tabular-nums">
          {progress.secondsLeft}
        </span>
      </div>
      {label && (
        <span className="font-display text-lg tracking-wide">{label}</span>
      )}
    </div>
  );
}
