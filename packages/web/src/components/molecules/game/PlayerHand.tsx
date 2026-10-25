import { type Hand, type HandResult, evaluateHand } from '@bustit/engine';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms/Badge';
import { Bill } from '@/components/atoms/Bill';
import { PlayingCard } from '@/components/atoms/PlayingCard';

interface PlayerHandProps {
  hand: Hand;
  /** How the hand ended, once the round is settled. */
  result?: HandResult;
}

/** The cards of one hand with its total, its stake and how it stands. */
export function PlayerHand({ hand, result }: PlayerHandProps) {
  const t = useTranslations('components.playerHand');
  const { total, soft } = evaluateHand(hand.cards);

  return (
    <div className="flex flex-col gap-2">
      {/* Overlapping cards keep the hand in one row, so a drawn card doesn't change the seat's height */}
      <ul className="flex">
        {hand.cards.map((card, index) => (
          <li key={index} className="-ml-6 first:ml-0">
            <PlayingCard card={card} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold tabular-nums">
          {soft ? t('totalSoft', { total }) : t('total', { total })}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
          <Bill />
          <span className="sr-only">{t('stakeLabel')}</span>
          {hand.stake}
        </span>
        {result ? <Outcome result={result} /> : <Status hand={hand} />}
      </div>
    </div>
  );
}

function Status({ hand }: { hand: Hand }) {
  const t = useTranslations('components.playerHand');

  switch (hand.status) {
    case 'bust':
      return <Badge variant="destructive">{t('status.bust')}</Badge>;
    case 'blackjack':
      return <Badge variant="primary">{t('status.blackjack')}</Badge>;
    case 'stood':
      return <Badge>{t('status.stood')}</Badge>;
    case 'playing':
      return null;
  }
}

function Outcome({ result }: { result: HandResult }) {
  const t = useTranslations('components.playerHand');
  const net = result.payout - result.stake;

  switch (result.outcome) {
    case 'blackjack':
      return <Badge variant="primary">{t('outcome.blackjack', { net })}</Badge>;
    case 'win':
      return <Badge variant="primary">{t('outcome.win', { net })}</Badge>;
    case 'push':
      return <Badge>{t('outcome.push')}</Badge>;
    case 'lose':
      return (
        <Badge variant="destructive">
          {t('outcome.lose', { stake: result.stake })}
        </Badge>
      );
  }
}
