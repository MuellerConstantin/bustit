'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 100;

export type TimerProgress = {
  /** The whole seconds left, rounded up. */
  readonly secondsLeft: number;
  /** How much of the timer is left, from 1 at its start to 0 at its end. */
  readonly fraction: number;
};

/**
 * How far a timer has run, `null` without one. The server's clock may differ
 * from the browser's, so the offset corrects the browser's.
 */
export function useTimerProgress(
  timer: { startedAt: string; endsAt: string } | null,
  clockOffsetMs = 0,
): TimerProgress | null {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = timer?.endsAt ?? null;

  useEffect(() => {
    if (!endsAt) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => clearInterval(interval);
  }, [endsAt]);

  if (!timer) {
    return null;
  }

  const startedAt = Date.parse(timer.startedAt);
  const left = Math.max(0, Date.parse(timer.endsAt) - (now + clockOffsetMs));
  const total = Date.parse(timer.endsAt) - startedAt;

  return {
    secondsLeft: Math.ceil(left / 1000),
    fraction: total > 0 ? Math.min(1, left / total) : 0,
  };
}
