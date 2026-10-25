'use client';

import { availableActions } from '@bustit/engine';
import { Maximize, Minimize } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DealerHand } from '@/components/molecules/game/DealerHand';
import { SeatPanel } from '@/components/molecules/game/SeatPanel';
import { TableFelt } from '@/components/molecules/game/TableFelt';
import { TableStage } from '@/components/molecules/game/TableStage';
import { TimerDialog } from '@/components/molecules/game/TimerDialog';
import { PlayControls } from '@/components/organisms/game/PlayControls';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTablePlay } from '@/hooks/useTablePlay';
import { useTimerProgress } from '@/hooks/useTimerProgress';

/* From this window width the game fits the window's height instead of scrolling the page. */
const FIT_MEDIA_QUERY = '(min-width: 64rem)';
const FIT_BOTTOM_GAP = 16;
const FIT_MIN_HEIGHT = 480;

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
  const progress = useTimerProgress(state?.timer ?? null, clockOffsetMs);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isFocused, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const isWide = useMediaQuery(FIT_MEDIA_QUERY);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  const hasState = state !== null;

  /*
   * The game takes the height between its top and the window's bottom, so the
   * table and the controls fit without scrolling. Fullscreen has the whole
   * window already. The page's size changes when content above wraps, so the
   * body is watched too.
   */
  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const fit = () => {
      const top = root.getBoundingClientRect().top + window.scrollY;

      setFitHeight(
        Math.max(FIT_MIN_HEIGHT, window.innerHeight - top - FIT_BOTTOM_GAP),
      );
    };
    const observer = new ResizeObserver(fit);

    observer.observe(document.body);
    window.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [hasState]);

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
  const runningRound = round && round.phase !== 'settled' ? round : null;
  // Bets are taken only once the last round's result has left the table.
  const bettingOpen = round === null;
  const turn = runningRound?.turn ?? null;
  const actions = runningRound
    ? (availableActions(runningRound)?.actions ?? [])
    : [];
  const isMyTurn = turn !== null && turn.seat === mySeat;
  const turnUserId = turn ? state.seats[turn.seat] : null;
  const height = isWide && !isFocused ? fitHeight : null;

  return (
    <div
      ref={rootRef}
      className={
        isFocused
          ? 'fixed inset-0 z-50 flex flex-col gap-6 overflow-auto bg-background p-4 pt-14'
          : 'relative flex flex-col gap-6 pt-10'
      }
      style={height ? { height } : undefined}
    >
      <Button
        variant="icon"
        className={isFocused ? 'absolute top-3 right-3' : 'absolute top-0 right-0'}
        aria-label={isFocused ? t('exitFullscreen') : t('fullscreen')}
        onPress={() => void toggleFullscreen()}
      >
        {isFocused ? <Minimize /> : <Maximize />}
      </Button>
      {status !== 'connected' && (
        <p role="status" className="shrink-0 text-sm text-muted-foreground">
          {t('disconnected')}
        </p>
      )}
      <TableStage>
        <TableFelt
          dealer={<DealerHand dealer={round?.dealer} />}
          overlay={
            progress && (
              <TimerDialog
                progress={progress}
                label={
                  state.timer?.kind === 'bet'
                    ? t('timer.bet')
                    : state.timer?.kind === 'turn' && isMyTurn
                      ? t('timer.turn')
                      : undefined
                }
              />
            )
          }
        >
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
        </TableFelt>
      </TableStage>
      {/* The phase is on the table, so only screen readers get it as text */}
      <p role="status" className="sr-only">
        {isMyTurn
          ? t('yourTurn')
          : turnUserId
            ? t('turnOf', { name: state.players[turnUserId] ?? '' })
            : round?.phase === 'dealerTurn'
              ? t('dealerTurn')
              : round?.phase === 'settled'
                ? t('roundOver')
                : state.bets.length > 0
                  ? t('dealing')
                  : t('placeBets')}
      </p>
      {/* A fixed height on wide windows, so the controls changing between phases don't resize the table */}
      <div className="flex shrink-0 flex-col gap-3 lg:h-16">
        <PlayControls
          isSeated={mySeat !== -1}
          isRoundRunning={!bettingOpen}
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
