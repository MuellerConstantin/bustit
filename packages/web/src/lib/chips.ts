/* Chip values follow a 1-2-5 ladder, the way coins and bills do. */
const LADDER = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
  100000, 200000, 500000, 1000000,
];
/* Which rungs of the ladder from the minimum on the chips take: 1, 5, 10, 50, 100 for a minimum of 1. */
const STEPS = [0, 2, 3, 5, 6];

/**
 * The values of the chips a table offers, from its minimum bet up. Chips
 * above the maximum bet are left out, and there is always at least one.
 */
export function chipValues(minBet: number, maxBet: number): number[] {
  const start = LADDER.findIndex((value) => value >= minBet);

  if (start === -1) {
    return [minBet];
  }

  const values = STEPS.map((step) => LADDER[start + step]).filter(
    (value): value is number => value !== undefined && value <= maxBet,
  );

  return values.length > 0 ? values : [minBet];
}
