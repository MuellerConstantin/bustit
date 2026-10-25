import { Children, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { seatSides } from '@/lib/seatSides';

interface TableFeltProps {
  /** The dealer, shown on the top side of the felt. */
  dealer: ReactNode;
  /** A dialog laid over the felt, e.g. the running timer. */
  overlay?: ReactNode;
  /** The seats in seat order, which runs down the left side, along the bottom and up the right side. */
  children: ReactNode;
}

/*
 * The grid has the dealer in the top row, the left and right seats beside the
 * felt's center, running down beside the bottom seats, which sit below the
 * center. The rows have fixed heights, sized for a seat's panel and the
 * dealer's, so the table is the same size whatever the number of seats and its
 * empty middle, where the dialog goes, stays where it is.
 */
const FELT_CLASSES =
  'table-cloth relative grid grid-cols-[auto_1fr_auto] grid-rows-[10rem_12.5rem_13rem] gap-6 rounded-(--felt-radius) p-8 shadow-[inset_0_0_24px_oklch(0_0_0/0.55)]';

/** The table's felt inside its painted rail, with the dealer on the top side and the seats on the other three. */
export function TableFelt({ dealer, overlay, children }: TableFeltProps) {
  const t = useTranslations('components.gameView');
  const seats = Children.toArray(children);
  const { left, bottom } = seatSides(seats.length);

  return (
    <div role="region" aria-label={t('table')} className="table-rail">
      {/* The rail's corners and straight pieces, drawn at the rail's thickness */}
      <span aria-hidden className="rail-corner rail-corner-tl" />
      <span aria-hidden className="rail-corner rail-corner-tr" />
      <span aria-hidden className="rail-corner rail-corner-bl" />
      <span aria-hidden className="rail-corner rail-corner-br" />
      <span aria-hidden className="rail-edge-h rail-edge-top" />
      <span aria-hidden className="rail-edge-h rail-edge-bottom" />
      <span aria-hidden className="rail-edge-v rail-edge-left" />
      <span aria-hidden className="rail-edge-v rail-edge-right" />
      <div className={FELT_CLASSES}>
        {/* A stitched line inside the cloth's edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-5 rounded-[inherit] border border-dashed border-felt-line"
        />
        <div className="col-span-3 row-start-1 flex justify-center">
          {dealer}
        </div>
        <div className="col-start-1 row-span-2 row-start-2 flex flex-col justify-center gap-4">
          {seats.slice(0, left)}
        </div>
        <div className="col-start-2 row-start-3 flex justify-center gap-6">
          {seats.slice(left, left + bottom)}
        </div>
        <div className="col-start-3 row-span-2 row-start-2 flex flex-col-reverse justify-center gap-4">
          {seats.slice(left + bottom)}
        </div>
        {/* The empty middle cell, above the bottom seats */}
        {overlay && (
          <div className="pointer-events-none z-10 col-start-2 row-start-2 flex items-center justify-center">
            {overlay}
          </div>
        )}
      </div>
    </div>
  );
}
