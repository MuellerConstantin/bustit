import { cardValue, cardsRemaining } from '../cards/index.js';
import { MAX_HANDS_PER_SEAT } from '../rules.js';
import type {
  ActionType,
  AvailableActions,
  Hand,
  HandRef,
  PublicRoundState,
  RoundState,
} from './types.js';

const ACTION_TYPES: readonly ActionType[] = ['hit', 'stand', 'double', 'split'];

/**
 * Lists what the hand to act may do and what each action costs, so the server
 * can reserve the stake before applying an action and clients only offer
 * valid ones. Returns `null` when no hand is left to act. It doesn't need the
 * shoe, so it works on the public view of a round as well.
 */
export function availableActions(
  round: Omit<RoundState, 'shoe'>,
): AvailableActions | null {
  const { turn } = round;

  if (round.phase === 'settled' || !turn) {
    return null;
  }

  const hand = handOf(round, turn);

  return {
    ...turn,
    actions: ACTION_TYPES.filter(
      (type) => actionNotAllowed(round, turn, type) === null,
    ).map((type) => ({
      type,
      additionalStake: type === 'double' || type === 'split' ? hand.stake : 0,
    })),
  };
}

/** The round as every client may see it, see `PublicRoundState`. */
export function publicView(round: RoundState): PublicRoundState {
  const { shoe, ...rest } = round;

  return {
    ...rest,
    dealer: {
      ...round.dealer,
      cards: round.dealer.holeCardHidden
        ? round.dealer.cards.slice(0, 1)
        : round.dealer.cards,
    },
    cardsRemaining: cardsRemaining(shoe),
  };
}

/**
 * Returns why the hand can't take the action, or `null` when it can. Turn and
 * phase are checked by the caller.
 */
export function actionNotAllowed(
  round: Omit<RoundState, 'shoe'>,
  ref: HandRef,
  type: ActionType,
): string | null {
  const { cards } = handOf(round, ref);

  switch (type) {
    case 'hit':
    case 'stand':
      return null;
    case 'double':
      return cards.length === 2
        ? null
        : 'A hand can only be doubled on its first two cards';
    case 'split': {
      const [first, second, ...rest] = cards;

      if (!first || !second || rest.length > 0) {
        return 'A hand can only be split on its first two cards';
      }

      if (cardValue(first) !== cardValue(second)) {
        return 'Only two cards of the same value can be split';
      }

      if (handsOf(round, ref.seat).length >= MAX_HANDS_PER_SEAT) {
        return `A seat can't play more than ${MAX_HANDS_PER_SEAT} hands`;
      }

      return null;
    }
  }
}

function handsOf(
  round: Omit<RoundState, 'shoe'>,
  seat: number,
): readonly Hand[] {
  return round.seats.find((entry) => entry.seat === seat)?.hands ?? [];
}

function handOf(round: Omit<RoundState, 'shoe'>, ref: HandRef): Hand {
  const hand = handsOf(round, ref.seat)[ref.hand];

  if (!hand) {
    throw new Error(`No hand ${ref.hand} at seat ${ref.seat}`);
  }

  return hand;
}
