import type { Hand, HandResult } from '@bustit/engine';
import { Armchair } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { tv } from 'tailwind-variants';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Bill } from '@/components/atoms/Bill';
import { Button } from '@/components/atoms/Button';
import { PlayerHand } from './PlayerHand';

interface SeatPanelProps {
  /** The name of the user on the seat, `undefined` for a free seat. */
  username?: string;
  isYou?: boolean;
  /** The hands of the current round, none outside of one. */
  hands?: readonly Hand[];
  /** The index of the hand to act, if it is on this seat. */
  turnHand?: number | null;
  results?: readonly HandResult[];
  /** The stake placed for the next round. */
  bet?: number;
  /** Whether the seat can be taken, i.e. the user can sit down on it. */
  canSit?: boolean;
  onSit?: () => void;
}

const panel = tv({
  base: 'flex h-52 w-44 flex-col gap-2 overflow-y-auto rounded-2xl border bg-card p-2 backdrop-blur-xl',
  variants: {
    isTurn: {
      true: 'border-primary ring-2 ring-primary',
      false: 'border-card-border',
    },
    isFree: {
      true: 'border-dashed',
    },
  },
});

/** One seat of the table: who sits there, their bet and their hands. */
export function SeatPanel({
  username,
  isYou = false,
  hands = [],
  turnHand = null,
  results = [],
  bet,
  canSit = false,
  onSit,
}: SeatPanelProps) {
  const t = useTranslations('components.seatPanel');

  return (
    <section
      className={panel({ isTurn: turnHand !== null, isFree: !username })}
    >
      <header className="flex items-center gap-2">
        {username ? (
          <>
            <Avatar name={username} />
            <span className="truncate text-sm font-semibold">{username}</span>
            {isYou && <Badge variant="primary">{t('you')}</Badge>}
            {bet !== undefined && (
              <span className="ml-auto flex shrink-0 items-center gap-1 text-sm tabular-nums">
                <Bill />
                <span className="sr-only">{t('betLabel')}</span>
                {bet}
              </span>
            )}
          </>
        ) : (
          <>
            <Armchair className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">{t('free')}</span>
          </>
        )}
      </header>
      {hands.map((hand, index) => (
        <div
          key={index}
          className={
            turnHand === index ? 'rounded-lg bg-primary/10 p-1' : 'p-1'
          }
        >
          <PlayerHand
            hand={hand}
            result={results.find((result) => result.hand === index)}
          />
        </div>
      ))}
      {!username && canSit && (
        <Button variant="secondary" onPress={onSit} className="mt-auto">
          {t('sit')}
        </Button>
      )}
    </section>
  );
}
