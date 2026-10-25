'use client';

import type { ActionType, AvailableAction } from '@bustit/engine';
import {
  ChevronsUp,
  CirclePlus,
  Hand,
  LogOut,
  RotateCcw,
  Split,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Bill } from '@/components/atoms/Bill';
import { BetChip, chipTone } from '@/components/atoms/BetChip';
import { Button } from '@/components/atoms/Button';
import { chipValues } from '@/lib/chips';

interface PlayControlsProps {
  /** Whether the user sits at the table. */
  isSeated: boolean;
  /**
   * Whether a round is being played or its result is still shown, as opposed
   * to taking bets.
   */
  isRoundRunning: boolean;
  isMyTurn: boolean;
  /** What the hand to act may do, empty unless it is the user's turn. */
  actions: readonly AvailableAction[];
  /** The stake the user has placed for the next round. */
  bet?: number;
  /** Whether any seat has placed a bet, so a round can be dealt. */
  hasBets: boolean;
  minBet: number;
  maxBet: number;
  /** What the user has to bet with, `undefined` while it is not known yet. */
  balance?: number;
  /** Blocks the controls while a message is on its way. */
  isPending: boolean;
  onBet: (stake: number) => void;
  onDeal: () => void;
  onAct: (type: ActionType) => void;
  onStand: () => void;
}

const ACTION_ICONS: Record<ActionType, ReactNode> = {
  hit: <CirclePlus aria-hidden />,
  stand: <Hand aria-hidden />,
  double: <ChevronsUp aria-hidden />,
  split: <Split aria-hidden />,
};

/** What the user can do right now: build a bet with chips and deal, or act on their hand. */
export function PlayControls({
  isSeated,
  isRoundRunning,
  isMyTurn,
  actions,
  bet,
  hasBets,
  minBet,
  maxBet,
  balance,
  isPending,
  onBet,
  onDeal,
  onAct,
  onStand,
}: PlayControlsProps) {
  const t = useTranslations('components.playControls');
  const format = useFormatter();
  const [stake, setStake] = useState(bet ?? minBet);

  if (!isSeated) {
    return null;
  }

  if (isRoundRunning) {
    return isMyTurn ? (
      <div
        role="group"
        aria-label={t('actionsLabel')}
        className="flex flex-wrap gap-2"
      >
        {actions.map(({ type, additionalStake }) => (
          <Button
            key={type}
            variant={type === 'hit' ? 'table-primary' : 'table'}
            isDisabled={isPending}
            onPress={() => onAct(type)}
          >
            {ACTION_ICONS[type]}
            {t(`actions.${type}`)}
            {additionalStake > 0 && (
              <span className="flex items-center gap-1 font-sans text-base tabular-nums">
                <Bill />
                {additionalStake}
              </span>
            )}
          </Button>
        ))}
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div
        role="group"
        aria-label={t('chipsLabel')}
        className="flex items-center gap-2"
      >
        {chipValues(minBet, maxBet).map((value, index) => (
          <BetChip
            key={value}
            label={format.number(value, { notation: 'compact' })}
            tone={chipTone(index)}
            aria-label={t('addToStake', { value })}
            // A chip the balance can't cover is locked, not just left out.
            isLocked={balance !== undefined && stake + value > balance}
            isDisabled={isPending || stake >= maxBet}
            onPress={() =>
              setStake((current) => Math.min(maxBet, current + value))
            }
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-2 font-display text-3xl tabular-nums">
          <Bill />
          <span className="sr-only">{t('stakeLabel')}</span>
          {format.number(stake)}
        </span>
        <Button
          variant="icon"
          aria-label={t('resetStake')}
          isDisabled={isPending || stake === minBet}
          onPress={() => setStake(minBet)}
        >
          <RotateCcw />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Button
          variant="table-primary"
          isDisabled={
            isPending ||
            bet === stake ||
            (balance !== undefined && stake > balance)
          }
          onPress={() => onBet(stake)}
        >
          {bet === undefined ? t('placeBet') : t('changeBet')}
        </Button>
        <Button
          variant="table"
          isDisabled={isPending || !hasBets}
          onPress={onDeal}
        >
          {t('deal')}
        </Button>
        <Button
          variant="icon"
          aria-label={t('leaveSeat')}
          isDisabled={isPending}
          onPress={onStand}
        >
          <LogOut />
        </Button>
      </div>
    </div>
  );
}
