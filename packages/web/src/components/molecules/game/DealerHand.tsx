import { type DealerHand as Dealer, evaluateHand } from '@bustit/engine';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms/Badge';
import { PlayingCard } from '@/components/atoms/PlayingCard';

interface DealerHandProps {
  /** Without a dealer hand, no round is dealt, and only an empty card shows. */
  dealer?: Dealer;
}

/**
 * The dealer as a card like the players' seats, lighter and with a white edge,
 * with their cards, the hole card face down while it is hidden.
 */
export function DealerHand({ dealer }: DealerHandProps) {
  const t = useTranslations('components.dealerHand');

  return (
    <section className="flex h-34 w-60 flex-col gap-2 rounded-2xl border border-foreground/70 bg-card/90 p-2 backdrop-blur-xl">
      <header className="relative flex h-8 items-center justify-center">
        <h2 className="font-display text-xl tracking-wide">{t('title')}</h2>
        {dealer && !dealer.holeCardHidden && (
          <Badge className="absolute right-0 text-foreground">
            {t('total', { total: evaluateHand(dealer.cards).total })}
          </Badge>
        )}
      </header>
      {dealer && (
        /* Overlapping cards keep the hand in one row and the card at a fixed height */
        <ul className="flex justify-center">
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
      )}
    </section>
  );
}
