import { Children, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { seatSides } from '@/lib/seatSides';

interface TableFeltProps {
  /** The dealer, shown on the top side of the felt. */
  dealer: ReactNode;
  /** The seats in seat order, which runs down the left side, along the bottom and up the right side. */
  children: ReactNode;
}

/*
 * Below the large breakpoint the seats flow in a two-column grid in seat order,
 * since three sides don't fit a phone. From there on the grid has the dealer in
 * the top row, the left and right seats beside the felt's center and the bottom
 * seats below it. From the extra large breakpoint the side seats also run down
 * beside the bottom seats, which saves a row of height once the width allows it.
 */
const FELT_CLASSES =
  'table-cloth relative grid grid-cols-2 gap-3 rounded-(--felt-radius) p-4 shadow-[inset_0_0_24px_oklch(0_0_0/0.55)] lg:grid-cols-[auto_1fr_auto] lg:grid-rows-[auto_1fr_auto] lg:gap-6 lg:p-8';

/** The table's felt inside its painted rail, with the dealer on the top side and the seats on the other three. */
export function TableFelt({ dealer, children }: TableFeltProps) {
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
          className="pointer-events-none absolute inset-3 rounded-[inherit] border border-dashed border-felt-line lg:inset-5"
        />
        <div className="col-span-2 flex justify-center lg:col-span-3 lg:row-start-1">
          {dealer}
        </div>
        <div className="contents lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:justify-center lg:gap-4 xl:row-span-2">
          {seats.slice(0, left)}
        </div>
        <div className="contents lg:col-span-3 lg:row-start-3 lg:flex lg:justify-center lg:gap-6 xl:col-span-1 xl:col-start-2">
          {seats.slice(left, left + bottom)}
        </div>
        <div className="contents lg:col-start-3 lg:row-start-2 lg:flex lg:flex-col-reverse lg:justify-center lg:gap-4 xl:row-span-2">
          {seats.slice(left + bottom)}
        </div>
      </div>
    </div>
  );
}
