'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 250;

/**
 * The whole seconds left until the deadline, `null` without one. The server's
 * clock may differ from the browser's, so the offset corrects the browser's.
 */
export function useCountdown(
  deadline: string | null,
  clockOffsetMs = 0,
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) {
    return null;
  }

  const left = Date.parse(deadline) - (now + clockOffsetMs);

  return Math.max(0, Math.ceil(left / 1000));
}
