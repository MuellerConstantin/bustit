'use client';

import { availableActions } from '@bustit/engine';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DealerHand } from '@/components/molecules/game/DealerHand';
import { SeatPanel } from '@/components/molecules/game/SeatPanel';
import { PlayControls } from '@/components/organisms/game/PlayControls';
import { useCountdown } from '@/hooks/useCountdown';
import { useTablePlay } from '@/hooks/useTablePlay';

interface GameViewProps {
  tableId: string;
  minBet: number;
  maxBet: number;
}

/** The table's game: the dealer, the seats and what the user can do. */
export function GameView({ tableId, minBet, maxBet }: GameViewProps) {
  const t = useTranslations('components.gameView');
  const {
    userId,
    clockOffsetMs,
    status,
    state,
    failure,
    sit,
    stand,
    bet,
    deal,
    act,
  } = useTablePlay(tableId);
  const [isPending, setIsPending] = useState(false);
  const secondsLeft = useCountdown(state?.deadline ?? null, clockOffsetMs);

  /** Blocks the controls until the server answered. */
  const run = async (message: () => Promise<unknown>) => {
    setIsPending(true);

    try {
      await message();
    } finally {
      setIsPending(false);
    }
  };

  if (!state) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <span className="sr-only">
          {status === 'connected' ? t('joining') : t('connecting')}
        </span>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const { round } = state;
  const mySeat = userId ? state.seats.indexOf(userId) : -1;
  const runningRound = round?.phase === 'playerTurns' ? round : null;
  const turn = runningRound?.turn ?? null;
  const actions = runningRound
    ? (availableActions(runningRound)?.actions ?? [])
    : [];
  const isMyTurn = turn !== null && turn.seat === mySeat;
  const turnUserId = turn ? state.seats[turn.seat] : null;

  return (
    <div className="flex flex-col gap-6">
      {status !== 'connected' && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('disconnected')}
        </p>
      )}
      <DealerHand dealer={round?.dealer} />
      <div className="flex flex-wrap gap-4">
        {state.seats.map((seatUserId, seat) => (
          <SeatPanel
            key={seat}
            username={seatUserId ? state.players[seatUserId] : undefined}
            isYou={seat === mySeat}
            hands={round?.seats.find((entry) => entry.seat === seat)?.hands}
            turnHand={turn?.seat === seat ? turn.hand : null}
            results={round?.results.filter((result) => result.seat === seat)}
            bet={state.bets.find((placed) => placed.seat === seat)?.stake}
            canSit={mySeat === -1 && status === 'connected'}
            onSit={() => void run(() => sit(seat))}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {isMyTurn
            ? t('yourTurn')
            : turnUserId
              ? t('turnOf', { name: state.players[turnUserId] ?? '' })
              : round?.phase === 'settled' && state.bets.length === 0
                ? t('roundOver')
                : state.bets.length > 0
                  ? t('dealing')
                  : t('placeBets')}
          {secondsLeft !== null && (
            <span className="ml-2 tabular-nums">
              {t('seconds', { seconds: secondsLeft })}
            </span>
          )}
        </p>
        <PlayControls
          isSeated={mySeat !== -1}
          isRoundRunning={runningRound !== null}
          isMyTurn={isMyTurn}
          actions={actions}
          bet={state.bets.find((placed) => placed.seat === mySeat)?.stake}
          hasBets={state.bets.length > 0}
          minBet={minBet}
          maxBet={maxBet}
          isPending={isPending}
          onBet={(stake) => void run(() => bet(stake))}
          onDeal={() => void run(deal)}
          onAct={(type) => void run(() => act(type))}
          onStand={() => void run(stand)}
        />
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${failure.error}`)}
          </p>
        )}
      </div>
    </div>
  );
}
