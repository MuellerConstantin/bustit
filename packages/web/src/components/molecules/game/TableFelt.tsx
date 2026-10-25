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
 * The layout follows the width of the container the table sits in, which the
 * stage fixes while it scales the table. In a narrow container the seats flow
 * in a two-column grid in seat order, since three sides don't fit there. In a
 * wide one the grid has the dealer in the top row, the left and right seats
 * beside the felt's center, running down beside the bottom seats, which sit
 * below the center. The rows have fixed heights, sized for a seat's panel and
 * the dealer's, so the table is the same size whatever the number of seats and
 * its empty middle, where the dialog goes, stays where it is.
 */
const FELT_CLASSES =
  'table-cloth relative grid grid-cols-2 gap-3 rounded-(--felt-radius) p-4 shadow-[inset_0_0_24px_oklch(0_0_0/0.55)] @5xl:grid-cols-[auto_1fr_auto] @5xl:grid-rows-[10rem_12.5rem_13rem] @5xl:gap-6 @5xl:p-8';

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
          className="pointer-events-none absolute inset-3 rounded-[inherit] border border-dashed border-felt-line @5xl:inset-5"
        />
        <div className="col-span-2 flex justify-center @5xl:col-span-3 @5xl:row-start-1">
          {dealer}
        </div>
        <div className="contents @5xl:col-start-1 @5xl:row-span-2 @5xl:row-start-2 @5xl:flex @5xl:flex-col @5xl:justify-center @5xl:gap-4">
          {seats.slice(0, left)}
        </div>
        <div className="contents @5xl:col-start-2 @5xl:row-start-3 @5xl:flex @5xl:justify-center @5xl:gap-6">
          {seats.slice(left, left + bottom)}
        </div>
        <div className="contents @5xl:col-start-3 @5xl:row-span-2 @5xl:row-start-2 @5xl:flex @5xl:flex-col-reverse @5xl:justify-center @5xl:gap-4">
          {seats.slice(left + bottom)}
        </div>
        {/* In the empty middle cell of a wide table, in the top corner of a narrow one */}
        {overlay && (
          <div className="pointer-events-none absolute top-4 right-4 z-10 origin-top-right scale-75 @5xl:static @5xl:col-start-2 @5xl:row-start-2 @5xl:flex @5xl:scale-100 @5xl:items-center @5xl:justify-center">
            {overlay}
          </div>
        )}
      </div>
    </div>
  );
}
