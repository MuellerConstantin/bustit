import { describe, expect, it } from 'vitest';
import { availableActions, publicView } from '../../src/round/queries.js';
import { act, play, ranks, start } from './helpers.js';

describe('availableActions', () => {
  it('offers everything on a pair', () => {
    const { round } = start({ seats: [['8', '8']], dealer: ['7', '10'] });

    expect(availableActions(round)).toEqual({
      seat: 0,
      hand: 0,
      actions: [
        { type: 'hit', additionalStake: 0 },
        { type: 'stand', additionalStake: 0 },
        { type: 'double', additionalStake: 10 },
        { type: 'split', additionalStake: 10 },
      ],
    });
  });

  it('offers no split on two cards of different value', () => {
    const { round } = start({ seats: [['10', '6']], dealer: ['7', '10'] });

    expect(availableActions(round)?.actions.map(({ type }) => type)).toEqual([
      'hit',
      'stand',
      'double',
    ]);
  });

  it('offers only hit and stand after a hit', () => {
    const { round } = act(
      start({ seats: [['4', '4']], dealer: ['7', '10'], draws: ['2'] }).round,
      'hit',
    );

    expect(availableActions(round)?.actions.map(({ type }) => type)).toEqual([
      'hit',
      'stand',
    ]);
  });

  it('prices actions by the stake of the hand', () => {
    const { round } = start(
      { seats: [['8', '8']], dealer: ['7', '10'] },
      {},
      [25],
    );

    expect(availableActions(round)?.actions).toContainEqual({
      type: 'split',
      additionalStake: 25,
    });
  });

  it('names the hand whose turn it is', () => {
    const { round } = play(
      start({ seats: [['8', '8']], dealer: ['7', '10'], draws: ['3', '2'] })
        .round,
      'split',
      'stand',
    );

    expect(availableActions(round)).toMatchObject({ seat: 0, hand: 1 });
  });

  it('offers the same on the public view of the round', () => {
    const { round } = start({ seats: [['8', '8']], dealer: ['7', '10'] });

    expect(availableActions(publicView(round))).toEqual(
      availableActions(round),
    );
  });

  it('returns null once the round is settled', () => {
    const { round } = start({ seats: [['10', '7']], dealer: ['A', 'K'] });

    expect(availableActions(round)).toBeNull();
  });
});

describe('publicView', () => {
  it('hides the hole card and the shoe', () => {
    const { round } = start({
      seats: [['10', '7']],
      dealer: ['6', 'K'],
      draws: ['2', '3'],
    });
    const view = publicView(round);

    expect(ranks(view.dealer.cards)).toEqual(['6']);
    expect(view.dealer.holeCardHidden).toBe(true);
    expect(view.cardsRemaining).toBe(2);
    expect(view).not.toHaveProperty('shoe');
  });

  it('shows the hole card once it is revealed', () => {
    const { round } = act(
      start({ seats: [['10', '7']], dealer: ['6', 'K'], draws: ['2'] }).round,
      'stand',
    );

    expect(ranks(publicView(round).dealer.cards)).toEqual(['6', 'K', '2']);
  });

  it('shows the single dealer card without a hole card', () => {
    const { round } = start(
      { seats: [['10', '7']], dealer: ['6'] },
      { holeCard: 'none' },
    );

    expect(ranks(publicView(round).dealer.cards)).toEqual(['6']);
  });

  it('keeps everything else as it is', () => {
    const { round } = start({ seats: [['10', '7']], dealer: ['6', 'K'] });
    const view = publicView(round);

    expect(view.seats).toBe(round.seats);
    expect(view.turn).toBe(round.turn);
    expect(view.rules).toBe(round.rules);
  });
});
