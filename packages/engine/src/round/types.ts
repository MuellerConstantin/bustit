import type { Card, Shoe } from '../cards/index.js';
import type { Rng } from '../rng.js';
import type { Outcome, TableRules } from '../rules.js';

export type Bet = {
  readonly seat: number;
  readonly stake: number;
};

export type HandStatus = 'playing' | 'stood' | 'bust' | 'blackjack';

export type FinishedHandStatus = Exclude<HandStatus, 'playing'>;

export type Hand = {
  readonly cards: readonly Card[];
  /** The stake on this hand, doubled once the hand is doubled. */
  readonly stake: number;
  readonly doubled: boolean;
  readonly status: HandStatus;
};

export type SeatHands = {
  readonly seat: number;
  readonly hands: readonly Hand[];
};

export type DealerHand = {
  readonly cards: readonly Card[];
  /** The second card is dealt face down and not revealed yet. */
  readonly holeCardHidden: boolean;
};

export type HandRef = {
  readonly seat: number;
  readonly hand: number;
};

export type HandResult = HandRef & {
  readonly outcome: Outcome;
  readonly stake: number;
  /** Amount handed back to the player, the stake included. */
  readonly payout: number;
};

/**
 * `dealerTurn` lasts from the last player decision until the round is
 * settled, and the dealer plays it one step per call of `dealerStep`.
 */
export type RoundPhase = 'playerTurns' | 'dealerTurn' | 'settled';

export type RoundState = {
  readonly phase: RoundPhase;
  readonly rules: TableRules;
  readonly shoe: Shoe;
  /** Only seats with a bet, in ascending seat order. */
  readonly seats: readonly SeatHands[];
  readonly dealer: DealerHand;
  /** The hand to act next, `null` once no hand is left to play. */
  readonly turn: HandRef | null;
  /** Empty until the round is settled. */
  readonly results: readonly HandResult[];
};

export type ActionType = 'hit' | 'stand' | 'double' | 'split';

export type PlayerAction = {
  readonly seat: number;
  readonly type: ActionType;
};

export type AvailableAction = {
  readonly type: ActionType;
  /** Stake the player has to add on top of the current one, e.g. to double. */
  readonly additionalStake: number;
};

export type AvailableActions = HandRef & {
  readonly actions: readonly AvailableAction[];
};

/**
 * What every client may see of a round. The shoe is reduced to the number of
 * cards left, since its order would reveal every card to come, and a
 * face-down hole card is left out of the dealer's cards.
 */
export type PublicRoundState = Omit<RoundState, 'shoe'> & {
  readonly cardsRemaining: number;
};

/**
 * Everything that happens in a round, in the order it happens. A face-down
 * hole card never shows up in an event, so events can be broadcast to every
 * client unchanged.
 */
export type RoundEvent =
  | { readonly type: 'shuffle' }
  | (HandRef & { readonly type: 'playerCard'; readonly card: Card })
  | { readonly type: 'dealerCard'; readonly card: Card }
  | { readonly type: 'holeCard' }
  | { readonly type: 'holeCardRevealed'; readonly card: Card }
  | (HandRef & { readonly type: 'double'; readonly stake: number })
  /**
   * The second card of the hand moves to a new hand with the same stake. New
   * hands are always appended to the seat, so hand indices never shift.
   */
  | (HandRef & {
      readonly type: 'split';
      readonly newHand: number;
      readonly stake: number;
    })
  | (HandRef & {
      readonly type: 'handFinished';
      readonly status: FinishedHandStatus;
    })
  | (HandRef & { readonly type: 'turn' })
  /** No hand is left to play, the dealer's turn begins. */
  | { readonly type: 'dealerTurn' }
  | { readonly type: 'settled'; readonly results: readonly HandResult[] };

export type RoundContext = {
  readonly rng: Rng;
};

export type RoundUpdate = {
  readonly round: RoundState;
  readonly events: readonly RoundEvent[];
};

export type EngineErrorCode =
  | 'INVALID_BETS'
  | 'NOT_YOUR_TURN'
  | 'ACTION_NOT_ALLOWED'
  | 'ROUND_FINISHED'
  | 'DEALER_TURN';

export type EngineError = {
  readonly code: EngineErrorCode;
  readonly message: string;
};

/** Outcome of an engine call; expected failures are values, not exceptions. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EngineError };

export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failure<T>(code: EngineErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}
