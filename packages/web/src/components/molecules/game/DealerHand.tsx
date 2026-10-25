import { type DealerHand as Dealer, evaluateHand } from '@bustit/engine';
import { useTranslations } from 'next-intl';
import { PlayingCard } from '@/components/atoms/PlayingCard';

interface DealerHandProps {
  /** Without a dealer hand, no round is dealt, and only an empty row shows. */
  dealer?: Dealer;
}

/** The dealer's cards, with the hole card shown face down while it is hidden. */
export function DealerHand({ dealer }: DealerHandProps) {
  const t = useTranslations('components.dealerHand');

  return (
    <section className="flex h-40 flex-col items-center gap-2">
      <h2 className="font-display text-2xl tracking-wide">{t('title')}</h2>
      {dealer && (
        <>
          {/* Overlapping cards keep the hand in one row and the section at a fixed height */}
          <ul className="flex">
            {dealer.cards.map((card, index) => (
              <li key={index} className="-ml-6 first:ml-0">
                <PlayingCard card={card} />
              </li>
            ))}
            {dealer.holeCardHidden && (
              <li className="-ml-6 first:ml-0">
                <PlayingCard />
              </li>
            )}
          </ul>
          {!dealer.holeCardHidden && (
            <p className="text-sm font-semibold tabular-nums">
              {t('total', { total: evaluateHand(dealer.cards).total })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
