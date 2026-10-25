import { evaluateHand } from '../cards/index.js';
import {
  type Draft,
  addHand,
  dealToHand,
  finishHand,
  getHand,
  handsAtSeat,
  hitHand,
  setHand,
  toDraft,
} from './draft.js';
import { continueRound } from './finish.js';
import { actionNotAllowed } from './queries.js';
import {
  type HandRef,
  type PlayerAction,
  type Result,
  type RoundContext,
  type RoundState,
  type RoundUpdate,
  failure,
  success,
} from './types.js';

/** Applies the action of the seat whose turn it is. */
export function applyAction(
  round: RoundState,
  action: PlayerAction,
  context: RoundContext,
): Result<RoundUpdate> {
  const { turn } = round;

  if (round.phase === 'dealerTurn') {
    return failure('DEALER_TURN', 'The dealer is still playing');
  }

  if (round.phase === 'settled' || !turn) {
    return failure('ROUND_FINISHED', 'The round is already settled');
  }

  if (action.seat !== turn.seat) {
    return failure(
      'NOT_YOUR_TURN',
      `Seat ${turn.seat} is to act, not seat ${action.seat}`,
    );
  }

  const notAllowed = actionNotAllowed(round, turn, action.type);

  if (notAllowed) {
    return failure('ACTION_NOT_ALLOWED', notAllowed);
  }

  const draft = toDraft(round, context.rng);

  switch (action.type) {
    case 'hit':
      hitHand(draft, turn);
      break;
    case 'stand':
      finishHand(draft, turn, 'stood');
      break;
    case 'double':
      double(draft, turn);
      break;
    case 'split':
      split(draft, turn);
      break;
  }

  return success(continueRound(draft));
}

/** Doubles the stake for exactly one more card. */
function double(draft: Draft, ref: HandRef): void {
  const hand = getHand(draft, ref);
  const stake = hand.stake * 2;

  setHand(draft, ref, { ...hand, stake, doubled: true });
  draft.events.push({ type: 'double', ...ref, stake });

  const { bust } = evaluateHand(dealToHand(draft, ref).cards);

  finishHand(draft, ref, bust ? 'bust' : 'stood');
}

/**
 * Moves the second card to a new hand at the end of the seat. The current
 * hand is dealt its second card right away, the new one once it is its turn.
 * Split aces get one card each and are finished, which also rules out
 * splitting them again.
 */
function split(draft: Draft, ref: HandRef): void {
  const hand = getHand(draft, ref);
  const [first, second] = hand.cards;

  if (!first || !second) {
    throw new Error('A split needs a hand of two cards');
  }

  const newHand = { seat: ref.seat, hand: handsAtSeat(draft, ref.seat) };

  setHand(draft, ref, { ...hand, cards: [first] });
  addHand(draft, newHand, {
    cards: [second],
    stake: hand.stake,
    doubled: false,
    status: 'playing',
  });
  draft.events.push({
    type: 'split',
    ...ref,
    newHand: newHand.hand,
    stake: hand.stake,
  });

  if (first.rank !== 'A') {
    hitHand(draft, ref);
    return;
  }

  for (const aceHand of [ref, newHand]) {
    dealToHand(draft, aceHand);
    finishHand(draft, aceHand, 'stood');
  }
}
