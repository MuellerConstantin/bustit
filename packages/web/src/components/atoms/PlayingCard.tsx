import type { Card } from '@bustit/engine';
import { useTranslations } from 'next-intl';
import { tv } from 'tailwind-variants';

interface PlayingCardProps {
  /** Without a card, the back is shown. */
  card?: Card;
  className?: string;
}

const SUIT_SYMBOLS = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
} as const;

const playingCard = tv({
  base: 'flex h-20 w-14 shrink-0 flex-col justify-between rounded-md border p-1.5 text-lg leading-none font-semibold shadow-sm select-none',
  variants: {
    face: {
      up: 'border-border bg-foreground text-background',
      down: 'border-primary bg-primary ring-2 ring-primary-foreground/30 ring-inset',
    },
    red: {
      true: 'text-destructive',
    },
  },
  defaultVariants: {
    face: 'up',
  },
});

/** A card of a deck, or its back for a card that is still face down. */
export function PlayingCard({ card, className }: PlayingCardProps) {
  const t = useTranslations('components.playingCard');

  if (!card) {
    return (
      <span
        role="img"
        aria-label={t('hidden')}
        className={playingCard({ face: 'down', className })}
      />
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <span
      role="img"
      aria-label={t('label', {
        rank: t(`ranks.${card.rank}`),
        suit: t(`suits.${card.suit}`),
      })}
      className={playingCard({
        red: card.suit === 'diamonds' || card.suit === 'hearts',
        className,
      })}
    >
      <span aria-hidden className="flex flex-col items-start">
        <span>{card.rank}</span>
        <span>{symbol}</span>
      </span>
    </span>
  );
}
