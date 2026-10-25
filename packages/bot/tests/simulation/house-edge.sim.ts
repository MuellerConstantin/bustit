import {
  DEFAULT_RULES,
  type Result,
  type TableRules,
  applyAction,
  availableActions,
  createSeededRng,
  createShoe,
  startRound,
} from '@bustit/engine';
import { describe, expect, it } from 'vitest';
import { basicStrategy } from '../../src/strategy.js';

/*
 * Plays a single seat by basic strategy and compares the house edge with the
 * published value for the rules. Invariants can't catch rules that are wrong
 * yet consistent, such as a payout off by a fraction; the house edge does.
 *
 * Blackjack results vary by about 1.15 units per hand, so after HANDS hands
 * the standard error is about 0.05 %. The tolerance covers three of them. The
 * seed is fixed, so a run is reproducible.
 */

const HANDS = 5_000_000;
const TOLERANCE = 0.0015;

/** Even, so a blackjack never pays a fractional chip that gets rounded down. */
const STAKE = 10;

describe.each<[string, TableRules, number]>([
  // 6 decks, S17, double after split, no surrender, no resplit aces.
  ['default rules', DEFAULT_RULES, 0.004],
  // Hitting soft 17 costs the player about 0.22 %. The strategy stays the
  // one for S17, which differs in a few rare spots worth well below 0.01 %.
  ['dealer hits soft 17', { ...DEFAULT_RULES, dealerHitsSoft17: true }, 0.0062],
  // Paying 6:5 instead of 3:2 costs the player about 1.4 %.
  ['6:5 blackjack', { ...DEFAULT_RULES, blackjackPayout: [6, 5] }, 0.0179],
])('house edge with %s', (name, rules, expected) => {
  it(`is about ${(expected * 100).toFixed(2)} %`, () => {
    const edge = simulateHouseEdge(rules, `house-edge-${name}`);

    console.info(`House edge with ${name}: ${(edge * 100).toFixed(3)} %`);

    expect(Math.abs(edge - expected)).toBeLessThan(TOLERANCE);
  });
});

/** Returns the share of the initial stakes the house wins. */
function simulateHouseEdge(rules: TableRules, seed: string): number {
  const rng = createSeededRng(seed);
  let shoe = createShoe(rules, rng);
  let net = 0;

  for (let i = 0; i < HANDS; i++) {
    let { round } = unwrap(
      startRound({ rules, shoe, bets: [{ seat: 0, stake: STAKE }] }, { rng }),
    );

    for (let available = availableActions(round); available;) {
      const hand = round.seats[0]!.hands[available.hand]!;
      const type = basicStrategy(
        hand.cards,
        round.dealer.cards[0]!,
        available.actions.map(({ type }) => type),
      );

      round = unwrap(applyAction(round, { seat: 0, type }, { rng })).round;
      available = availableActions(round);
    }

    for (const result of round.results) {
      net += result.payout - result.stake;
    }

    shoe = round.shoe;
  }

  return -net / (HANDS * STAKE);
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  return result.value;
}
