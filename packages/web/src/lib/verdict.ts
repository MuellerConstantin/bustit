import type { HandResult } from '@bustit/engine';

/** How a round ended for one seat, over all of its hands. */
export type Verdict = 'blackjack' | 'win' | 'push' | 'lose';

/**
 * The verdict of a seat's hands, `null` without any, e.g. for someone who only
 * watched. The hands count by what they paid out beyond their stakes, so a
 * split that wins one hand and loses the other evens out to a push.
 */
export function verdictOf(results: readonly HandResult[]): Verdict | null {
  if (results.length === 0) {
    return null;
  }

  const net = results.reduce(
    (sum, result) => sum + result.payout - result.stake,
    0,
  );

  if (net > 0) {
    return results.some((result) => result.outcome === 'blackjack')
      ? 'blackjack'
      : 'win';
  }

  return net < 0 ? 'lose' : 'push';
}
