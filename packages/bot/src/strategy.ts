import {
  type ActionType,
  type Card,
  cardValue,
  evaluateHand,
} from '@bustit/engine';

/*
 * Basic strategy for 4 to 8 decks, dealer stands on soft 17, double after
 * split, no surrender. Rows are indexed by the dealer's up card from 2 to ace.
 *
 * H hit, S stand, D double else hit, Ds double else stand, P split.
 */
type Play = 'H' | 'S' | 'D' | 'Ds' | 'P';

/** One play per dealer up card, from 2 to ace. */
type Row = readonly Play[];

const HARD: Readonly<Record<number, Row>> = {
  8: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  9: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  10: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  11: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H'],
  12: ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  13: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  14: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  15: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  16: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
};

const SOFT: Readonly<Record<number, Row>> = {
  13: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  14: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  15: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  16: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  17: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  18: ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
};

/** Pairs not listed here are never split and play by their total. */
const PAIRS: Readonly<Record<number, Row>> = {
  1: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  2: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  3: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  4: ['H', 'H', 'H', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  6: ['P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  7: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  8: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  9: ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
};

/** Picks the basic strategy play among the actions the engine offers. */
export function basicStrategy(
  cards: readonly Card[],
  dealerUpCard: Card,
  available: readonly ActionType[],
): ActionType {
  const column = dealerColumn(dealerUpCard);
  const [first, second] = cards;

  if (
    available.includes('split') &&
    first &&
    second &&
    cardValue(first) === cardValue(second)
  ) {
    if (PAIRS[cardValue(first)]?.[column] === 'P') {
      return 'split';
    }
  }

  const { total, soft } = evaluateHand(cards);
  const play = soft ? softPlay(total, column) : hardPlay(total, column);
  const canDouble = available.includes('double');

  switch (play) {
    case 'D':
      return canDouble ? 'double' : 'hit';
    case 'Ds':
      return canDouble ? 'double' : 'stand';
    case 'H':
      return 'hit';
    case 'S':
    case 'P':
      return 'stand';
  }
}

function hardPlay(total: number, column: number): Play {
  if (total >= 17) {
    return 'S';
  }

  return HARD[Math.max(total, 8)]![column]!;
}

function softPlay(total: number, column: number): Play {
  if (total >= 19) {
    return 'S';
  }

  // A soft 12 is a pair of aces that can't be split any more.
  return SOFT[total]?.[column] ?? 'H';
}

/** Column 0 is a dealer 2, column 9 an ace. */
function dealerColumn(card: Card): number {
  const value = cardValue(card);
  return value === 1 ? 9 : value - 2;
}
