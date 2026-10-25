'use client';

import { availableActions } from '@bustit/engine';
import { Maximize, Minimize } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Bill } from '@/components/atoms/Bill';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DealerHand } from '@/components/molecules/game/DealerHand';
import { SeatPanel } from '@/components/molecules/game/SeatPanel';
import { TableFelt } from '@/components/molecules/game/TableFelt';
import { TableStage } from '@/components/molecules/game/TableStage';
import {
  type TimerTitle,
  type TitleTone,
  TimerDialog,
} from '@/components/molecules/game/TimerDialog';
import { PlayControls } from '@/components/organisms/game/PlayControls';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useOwnUser } from '@/hooks/useOwnUser';
import { useTablePlay } from '@/hooks/useTablePlay';
import { useTimerProgress } from '@/hooks/useTimerProgress';
import { type Verdict, verdictOf } from '@/lib/verdict';

const FIT_BOTTOM_GAP = 16;
const FIT_MIN_HEIGHT = 480;

const VERDICT_TONES: Record<Verdict, TitleTone> = {
  blackjack: 'gold',
  win: 'gold',
  push: 'plain',
  lose: 'red',
};

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
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  const hasState = state !== null;
  const format = useFormatter();
  const { user, reload: reloadUser } = useOwnUser();
  const roundPhase = state?.round?.phase ?? null;
  const placedStakes =
    state?.bets.reduce((sum, placed) => sum + placed.stake, 0) ?? 0;

  /*
   * The balance isn't part of the table's state. Placing bets and settling a
   * round are what move it, so it is asked for again whenever either changes.
   */
  useEffect(() => {
    void reloadUser();
  }, [roundPhase, placedStakes, reloadUser]);

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
  const height = isFocused ? null : fitHeight;
  /*
   * Once the round is settled the dialog says how it went: for the user if they
   * played, otherwise only that it is over, which is all a watcher can say.
   */
  const verdict =
    round?.phase === 'settled'
      ? verdictOf(round.results.filter((result) => result.seat === mySeat))
      : null;
  const isSettled = round?.phase === 'settled';
  /* The lettering names what the table waits for, or how the round ended. */
  const title: TimerTitle | undefined = isSettled
    ? verdict
      ? { text: t(`verdict.${verdict}`), tone: VERDICT_TONES[verdict] }
      : { text: t('verdict.over'), tone: 'plain' }
    : state.timer?.kind === 'bet'
      ? { text: t('timer.bet'), tone: 'plain' }
      : state.timer?.kind === 'turn' && isMyTurn
        ? { text: t('timer.turn'), tone: 'gold' }
        : undefined;

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
        className={
          isFocused ? 'absolute top-3 right-3' : 'absolute top-0 right-0'
        }
        aria-label={isFocused ? t('exitFullscreen') : t('fullscreen')}
        onPress={() => void toggleFullscreen()}
      >
        {isFocused ? <Minimize /> : <Maximize />}
      </Button>
      {user && (
        <p
          className={
            isFocused
              ? 'absolute top-3 left-3 flex h-9 items-center gap-2 font-display text-2xl tabular-nums'
              : 'absolute top-0 left-0 flex h-9 items-center gap-2 font-display text-2xl tabular-nums'
          }
        >
          <Bill />
          <span className="sr-only">{t('balance')}</span>
          {format.number(user.balance)}
        </p>
      )}
      {status !== 'connected' && (
        <p role="status" className="shrink-0 text-sm text-muted-foreground">
          {t('disconnected')}
        </p>
      )}
      <TableStage>
        <TableFelt
          dealer={<DealerHand dealer={round?.dealer} />}
          overlay={
            (progress || title) && (
              <TimerDialog
                progress={progress}
                title={title}
                isCalm={isSettled}
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
      {/* A fixed height, so the controls changing between phases don't resize the table */}
      <div className="flex h-16 shrink-0 flex-col gap-3">
        <PlayControls
          isSeated={mySeat !== -1}
          isRoundRunning={!bettingOpen}
          isMyTurn={isMyTurn}
          actions={actions}
          bet={state.bets.find((placed) => placed.seat === mySeat)?.stake}
          hasBets={state.bets.length > 0}
          minBet={minBet}
          maxBet={maxBet}
          balance={user?.balance}
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
