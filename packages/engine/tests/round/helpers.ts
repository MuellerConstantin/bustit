import type { Card, Rank, Shoe } from '../../src/cards/index.js';
import { createSeededRng } from '../../src/rng.js';
import { applyAction } from '../../src/round/apply.js';
import { dealerStep } from '../../src/round/finish.js';
import { startRound } from '../../src/round/start.js';
import type {
  ActionType,
  Bet,
  Result,
  RoundState,
  RoundUpdate,
} from '../../src/round/types.js';
import { DEFAULT_RULES, type TableRules } from '../../src/rules.js';

export const context = { rng: createSeededRng('test') };

export function card(rank: Rank): Card {
  return { rank, suit: 'spades' };
}

export function ranks(cards: readonly Card[]): Rank[] {
  return cards.map(({ rank }) => rank);
}

type StackedDeal = {
  /** First and second card of every seat, in seat order. */
  readonly seats: readonly (readonly [Rank, Rank])[];
  /** Up card and, when peeking, the hole card. */
  readonly dealer: readonly Rank[];
  /** Cards drawn after the deal, in the order they are drawn. */
  readonly draws?: readonly Rank[];
};

/**
 * Builds a shoe that deals exactly the given cards, in the order startRound
 * deals them, so scenarios read as hands instead of a flat card sequence.
 */
export function stackedShoe({ seats, dealer, draws = [] }: StackedDeal): Shoe {
  const order: Rank[] = [
    ...seats.map(([first]) => first),
    ...dealer.slice(0, 1),
    ...seats.map(([, second]) => second),
    ...dealer.slice(1),
    ...draws,
  ];

  return {
    cards: order.map(card),
    position: 0,
    cutPosition: order.length,
  };
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  return result.value;
}

/*
 * Plays the dealer's turn to its end, so tests see a settled round unless they
 * test the dealer's steps themselves.
 */
export function finishDealer(update: RoundUpdate): RoundUpdate {
  let { round, events } = update;

  while (round.phase === 'dealerTurn') {
    const step = unwrap(dealerStep(round, context));
    round = step.round;
    events = [...events, ...step.events];
  }

  return { round, events };
}

export function start(
  deal: StackedDeal,
  rules: Partial<TableRules> = {},
  stakes: readonly number[] = deal.seats.map(() => 10),
): RoundUpdate {
  const bets: Bet[] = stakes.map((stake, seat) => ({ seat, stake }));

  return finishDealer(
    unwrap(
      startRound(
        {
          rules: { ...DEFAULT_RULES, ...rules },
          shoe: stackedShoe(deal),
          bets,
        },
        context,
      ),
    ),
  );
}

/** Acts for the seat whose turn it is. */
export function act(round: RoundState, type: ActionType): RoundUpdate {
  if (!round.turn) {
    throw new Error('No hand is left to act');
  }

  return finishDealer(
    unwrap(applyAction(round, { seat: round.turn.seat, type }, context)),
  );
}

/** Applies the actions in order, each for the seat whose turn it is. */
export function play(round: RoundState, ...types: ActionType[]): RoundUpdate {
  let update: RoundUpdate = { round, events: [] };

  for (const type of types) {
    const next = act(update.round, type);
    update = { round: next.round, events: [...update.events, ...next.events] };
  }

  return update;
}
