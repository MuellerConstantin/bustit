'use client';

import type { ActionType, AvailableAction } from '@bustit/engine';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bill } from '@/components/atoms/Bill';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';

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
  /** Blocks the controls while a message is on its way. */
  isPending: boolean;
  onBet: (stake: number) => void;
  onDeal: () => void;
  onAct: (type: ActionType) => void;
  onStand: () => void;
}

/** What the user can do right now: place a bet and deal, or act on their hand. */
export function PlayControls({
  isSeated,
  isRoundRunning,
  isMyTurn,
  actions,
  bet,
  hasBets,
  minBet,
  maxBet,
  isPending,
  onBet,
  onDeal,
  onAct,
  onStand,
}: PlayControlsProps) {
  const t = useTranslations('components.playControls');
  const [stake, setStake] = useState(bet ?? minBet);

  if (!isSeated) {
    return <p className="text-sm text-muted-foreground">{t('spectator')}</p>;
  }

  if (isRoundRunning) {
    return isMyTurn ? (
      <div role="group" aria-label={t('actionsLabel')} className="flex flex-wrap gap-2">
        {actions.map(({ type, additionalStake }) => (
          <Button
            key={type}
            variant={type === 'stand' ? 'secondary' : 'primary'}
            isDisabled={isPending}
            onPress={() => onAct(type)}
          >
            {t(`actions.${type}`)}
            {additionalStake > 0 && (
              <span className="flex items-center gap-1 tabular-nums">
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
    <div className="flex flex-wrap items-end gap-3">
      <NumberField
        label={t('stakeLabel')}
        value={stake}
        onChange={setStake}
        minValue={minBet}
        maxValue={maxBet}
        className="w-40"
      />
      <Button
        isDisabled={isPending || Number.isNaN(stake)}
        onPress={() => onBet(stake)}
      >
        {bet === undefined ? t('placeBet') : t('changeBet')}
      </Button>
      <Button isDisabled={isPending || !hasBets} onPress={onDeal}>
        {t('deal')}
      </Button>
      <Button variant="secondary" isDisabled={isPending} onPress={onStand}>
        {t('leaveSeat')}
      </Button>
    </div>
  );
}
