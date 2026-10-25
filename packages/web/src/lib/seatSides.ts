/** How many seats sit on each side of the table. */
export interface SeatSides {
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

/*
 * Seats run down the left side, along the bottom and up the right side, so the
 * seat order follows the rim of the table. The bottom takes a third of the
 * seats, rounded up, and the sides share the rest with the left one getting the
 * extra seat if the numbers are uneven.
 */
export function seatSides(seatCount: number): SeatSides {
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    throw new RangeError(`A table needs at least one seat, got ${seatCount}`);
  }

  const bottom = Math.ceil(seatCount / 3);
  const left = Math.ceil((seatCount - bottom) / 2);

  return { left, bottom, right: seatCount - bottom - left };
}
