import { describe, expect, it } from 'vitest';
import { type Card, type Shoe, createShoe } from '../../src/cards/index.js';
import { type Rng, createSeededRng } from '../../src/rng.js';
import { applyAction } from '../../src/round/apply.js';
import { dealerStep } from '../../src/round/finish.js';
import { availableActions, publicView } from '../../src/round/queries.js';
import { startRound } from '../../src/round/start.js';
import type {
  ActionType,
  Bet,
  HandRef,
  HandResult,
  HandStatus,
  RoundEvent,
  RoundState,
} from '../../src/round/types.js';
import {
  DEFAULT_RULES,
  MAX_HANDS_PER_SEAT,
  type TableRules,
  payout,
} from '../../src/rules.js';
import { unwrap } from './helpers.js';

/*
 * Plays many rounds with random bets and random decisions on a real shoe and
 * checks properties that must hold for every round, independent of the cards.
 * This catches what the hand-written scenarios didn't think of.
 */

const ROUNDS = 2_000;
const MAX_ACTIONS_PER_ROUND = 100;
const SEATS = 6;
const ACTION_TYPES: readonly ActionType[] = ['hit', 'stand', 'double', 'split'];

type MirroredHand = { cards: Card[]; stake: number; status: HandStatus };

/** Round state rebuilt from events alone, the way a client would. */
type Mirror = {
  seats: Map<number, MirroredHand[]>;
  dealer: Card[];
  holeCardHidden: boolean;
  turn: HandRef | null;
  results: readonly HandResult[] | null;
};

describe.each<[string, TableRules]>([
  ['default rules', DEFAULT_RULES],
  [
    'no hole card, dealer hits soft 17',
    { ...DEFAULT_RULES, holeCard: 'none', dealerHitsSoft17: true },
  ],
  [
    'single deck, early reshuffle',
    { ...DEFAULT_RULES, decks: 1, penetration: 0.5 },
  ],
])('random rounds with %s', (name, rules) => {
  it('keep every invariant', () => {
    const rng = createSeededRng(`invariants-${name}`);
    let shoe = createShoe(rules, rng);

    for (let i = 0; i < ROUNDS; i++) {
      shoe = playRandomRound(rules, shoe, rng);
    }
  });
});

function playRandomRound(rules: TableRules, shoe: Shoe, rng: Rng): Shoe {
  const bets = randomBets(rng);
  const started = unwrap(startRound({ rules, shoe, bets }, { rng }));
  const mirror = createMirror(bets);
  const events: RoundEvent[] = [...started.events];
  let round = started.round;

  replay(mirror, started.events);
  expectMirrorMatches(mirror, round);

  for (let actions = 0; round.turn; actions++) {
    expect(actions).toBeLessThan(MAX_ACTIONS_PER_ROUND);

    const available = availableActions(round);
    expect(available).toMatchObject(round.turn);

    const allowed = available!.actions.map(({ type }) => type);
    const forbidden = ACTION_TYPES.filter((type) => !allowed.includes(type));

    for (const type of forbidden) {
      const result = applyAction(
        round,
        { seat: round.turn.seat, type },
        { rng },
      );
      expect(!result.ok && result.error.code).toBe('ACTION_NOT_ALLOWED');
    }

    const type = allowed[rng.nextInt(allowed.length)]!;
    const update = unwrap(
      applyAction(round, { seat: round.turn.seat, type }, { rng }),
    );

    replay(mirror, update.events);
    events.push(...update.events);
    round = update.round;
    expectMirrorMatches(mirror, round);
  }

  while (round.phase === 'dealerTurn') {
    const step = unwrap(dealerStep(round, { rng }));

    replay(mirror, step.events);
    events.push(...step.events);
    round = step.round;
    expectMirrorMatches(mirror, round);
  }

  expectSettled(round);
  expectCardsConserved(shoe, round, events);

  return round.shoe;
}

function randomBets(rng: Rng): Bet[] {
  const seats = Array.from({ length: SEATS }, (_, seat) => seat).filter(
    () => rng.nextInt(2) === 1,
  );

  return (seats.length > 0 ? seats : [rng.nextInt(SEATS)]).map((seat) => ({
    seat,
    stake: 1 + rng.nextInt(100),
  }));
}

function expectSettled(round: RoundState): void {
  const hands = round.seats.flatMap(({ seat, hands }) =>
    hands.map((hand, index) => ({ seat, index, hand })),
  );

  expect(round.phase).toBe('settled');
  expect(round.turn).toBeNull();
  expect(round.dealer.holeCardHidden).toBe(false);
  expect(round.results).toHaveLength(hands.length);

  for (const { hands } of round.seats) {
    expect(hands.length).toBeLessThanOrEqual(MAX_HANDS_PER_SEAT);
  }

  for (const { seat, index, hand } of hands) {
    const result = round.results.find(
      (entry) => entry.seat === seat && entry.hand === index,
    );

    expect(result).toBeDefined();
    expect(result!.stake).toBe(hand.stake);
    expect(result!.payout).toBe(
      payout(result!.outcome, hand.stake, round.rules),
    );

    if (hand.status === 'bust') {
      expect(result!.outcome).toBe('lose');
    }
  }
}

/**
 * Every card on the table came from the shoe, none twice and none lost.
 * Rounds that ran out of cards midway start a fresh shoe and are skipped.
 */
function expectCardsConserved(
  shoe: Shoe,
  round: RoundState,
  events: readonly RoundEvent[],
): void {
  const shuffles = events.filter(({ type }) => type === 'shuffle').length;
  const shuffledAtStart = events[0]?.type === 'shuffle';

  if (shuffles > (shuffledAtStart ? 1 : 0)) {
    return;
  }

  const dealt = round.shoe.cards.slice(
    shuffledAtStart ? 0 : shoe.position,
    round.shoe.position,
  );
  const onTable = [
    ...round.seats.flatMap(({ hands }) => hands.flatMap(({ cards }) => cards)),
    ...round.dealer.cards,
  ];

  expect(onTable).toHaveLength(dealt.length);
  expect(new Set(onTable)).toEqual(new Set(dealt));
}

function createMirror(bets: readonly Bet[]): Mirror {
  return {
    seats: new Map(
      bets.map(({ seat, stake }) => [
        seat,
        [{ cards: [], stake, status: 'playing' }],
      ]),
    ),
    dealer: [],
    holeCardHidden: false,
    turn: null,
    results: null,
  };
}

function replay(mirror: Mirror, events: readonly RoundEvent[]): void {
  const handAt = ({ seat, hand }: HandRef): MirroredHand => {
    const entry = mirror.seats.get(seat)?.[hand];
    expect(entry).toBeDefined();
    return entry!;
  };

  for (const event of events) {
    switch (event.type) {
      case 'shuffle':
        break;
      case 'playerCard':
        handAt(event).cards.push(event.card);
        break;
      case 'dealerCard':
        mirror.dealer.push(event.card);
        break;
      case 'holeCard':
        mirror.holeCardHidden = true;
        break;
      case 'holeCardRevealed':
        mirror.dealer.push(event.card);
        mirror.holeCardHidden = false;
        break;
      case 'double':
        handAt(event).stake = event.stake;
        break;
      case 'split': {
        const hands = mirror.seats.get(event.seat)!;
        const card = handAt(event).cards.pop()!;

        expect(event.newHand).toBe(hands.length);
        hands.push({ cards: [card], stake: event.stake, status: 'playing' });
        break;
      }
      case 'handFinished':
        handAt(event).status = event.status;
        break;
      case 'turn':
        mirror.turn = { seat: event.seat, hand: event.hand };
        break;
      case 'dealerTurn':
        mirror.turn = null;
        break;
      case 'settled':
        mirror.turn = null;
        mirror.results = event.results;
        break;
    }
  }
}

/** What a client rebuilt from events is exactly what `publicView` shows. */
function expectMirrorMatches(mirror: Mirror, round: RoundState): void {
  const view = publicView(round);

  expect(
    view.seats.map(({ seat, hands }) => [
      seat,
      hands.map(({ cards, stake, status }) => ({ cards, stake, status })),
    ]),
  ).toEqual([...mirror.seats.entries()]);
  expect(view.dealer.cards).toEqual(mirror.dealer);
  expect(view.dealer.holeCardHidden).toBe(mirror.holeCardHidden);

  if (view.phase === 'settled') {
    expect(mirror.results).toEqual(view.results);
  } else {
    expect(mirror.turn).toEqual(view.turn);
  }
}
