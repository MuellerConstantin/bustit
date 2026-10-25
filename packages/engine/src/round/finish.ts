import { evaluateHand, isBlackjack } from '../cards/index.js';
import { type Outcome, payout } from '../rules.js';
import {
  type Draft,
  advanceTurn,
  dealToDealer,
  getHand,
  hitHand,
  toDraft,
  toRound,
} from './draft.js';
import {
  type HandResult,
  type Hand,
  type Result,
  type RoundContext,
  type RoundState,
  type RoundUpdate,
  failure,
  success,
} from './types.js';

const DEALER_STANDS_ON = 17;

/**
 * Moves on to the next hand in play. A hand created by a split gets its
 * second card once it is its turn. Once no hand is left, the dealer's turn
 * begins, and the dealer plays it step by step with `dealerStep`.
 */
export function continueRound(draft: Draft): RoundUpdate {
  for (advanceTurn(draft); draft.turn; advanceTurn(draft)) {
    if (getHand(draft, draft.turn).cards.length >= 2) {
      return { round: toRound(draft, null), events: draft.events };
    }

    hitHand(draft, draft.turn);
  }

  draft.events.push({ type: 'dealerTurn' });

  return { round: dealerRound(draft), events: draft.events };
}

/**
 * Plays one step of the dealer's turn: reveals or deals the dealer's cards,
 * draws one card if the dealer must hit, or settles the round once the dealer
 * stands. Every step returns the events it caused, so a server can pace them.
 *
 * @returns a `ROUND_FINISHED` failure if the round is not in its dealer phase.
 */
export function dealerStep(
  round: RoundState,
  context: RoundContext,
): Result<RoundUpdate> {
  if (round.phase !== 'dealerTurn') {
    return failure('ROUND_FINISHED', 'The dealer is not playing');
  }

  const draft = toDraft(round, context.rng);

  if (draft.dealer.holeCardHidden) {
    revealHoleCard(draft);
  } else if (draft.dealer.cards.length < 2 || dealerMustDraw(draft)) {
    dealToDealer(draft);
  } else {
    return success(settle(draft));
  }

  return success({ round: dealerRound(draft), events: draft.events });
}

export function revealHoleCard(draft: Draft): void {
  const holeCard = draft.dealer.cards[1];

  if (!draft.dealer.holeCardHidden || !holeCard) {
    return;
  }

  draft.dealer.holeCardHidden = false;
  draft.events.push({ type: 'holeCardRevealed', card: holeCard });
}

export function settle(draft: Draft): RoundUpdate {
  const dealer = evaluateHand(draft.dealer.cards);
  const dealerBlackjack = isBlackjack(draft.dealer.cards);

  const results: HandResult[] = draft.seats.flatMap(({ seat, hands }) =>
    hands.map((hand, index) => {
      const outcome = outcomeOf(
        hand,
        dealer.total,
        dealer.bust,
        dealerBlackjack,
      );

      return {
        seat,
        hand: index,
        outcome,
        stake: hand.stake,
        payout: payout(outcome, hand.stake, draft.rules),
      };
    }),
  );

  draft.turn = null;
  draft.events.push({ type: 'settled', results });

  return { round: toRound(draft, results), events: draft.events };
}

/** The round as it waits for the dealer, which plays step by step. */
function dealerRound(draft: Draft): RoundState {
  return { ...toRound(draft, null), phase: 'dealerTurn' };
}

/*
 * Without a hand left that could beat the dealer, drawing changes nothing, so
 * the dealer stands right away.
 */
function dealerMustDraw(draft: Draft): boolean {
  const aLiveHandRemains = draft.seats.some(({ hands }) => hands.some(isLive));

  return aLiveHandRemains && mustHit(draft);
}

function isLive(hand: Hand): boolean {
  return hand.status !== 'bust' && hand.status !== 'blackjack';
}

function mustHit(draft: Draft): boolean {
  const { total, soft } = evaluateHand(draft.dealer.cards);

  return (
    total < DEALER_STANDS_ON ||
    (total === DEALER_STANDS_ON && soft && draft.rules.dealerHitsSoft17)
  );
}

function outcomeOf(
  hand: Hand,
  dealerTotal: number,
  dealerBust: boolean,
  dealerBlackjack: boolean,
): Outcome {
  if (hand.status === 'bust') {
    return 'lose';
  }

  if (hand.status === 'blackjack') {
    return dealerBlackjack ? 'push' : 'blackjack';
  }

  if (dealerBlackjack) {
    return 'lose';
  }

  if (dealerBust) {
    return 'win';
  }

  const total = evaluateHand(hand.cards).total;

  if (total > dealerTotal) {
    return 'win';
  }

  return total === dealerTotal ? 'push' : 'lose';
}
