import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/round/apply.js';
import { dealerStep } from '../../src/round/finish.js';
import { context, start, unwrap } from './helpers.js';

/*
 * The dealer plays one step per call, so a server can pace the cards. Each
 * step returns the events it caused, and only the last one settles the round.
 */

describe('dealer steps', () => {
  it('starts the dealer phase once the last hand stands, and rejects actions', () => {
    const { round } = start({
      seats: [['10', '9']],
      dealer: ['10', '6'],
      draws: ['5'],
    });

    const { round: waiting, events } = unwrap(
      applyAction(round, { seat: 0, type: 'stand' }, context),
    );

    expect(waiting.phase).toBe('dealerTurn');
    expect(waiting.turn).toBeNull();
    expect(events.map(({ type }) => type)).toEqual([
      'handFinished',
      'dealerTurn',
    ]);

    expect(
      applyAction(waiting, { seat: 0, type: 'hit' }, context),
    ).toMatchObject({ ok: false, error: { code: 'DEALER_TURN' } });
  });

  it('reveals, draws and settles one step at a time', () => {
    const { round } = start({
      seats: [['10', '9']],
      dealer: ['10', '6'],
      draws: ['5'],
    });
    const { round: waiting } = unwrap(
      applyAction(round, { seat: 0, type: 'stand' }, context),
    );

    const reveal = unwrap(dealerStep(waiting, context));

    expect(reveal.round.phase).toBe('dealerTurn');
    expect(reveal.events.map(({ type }) => type)).toEqual(['holeCardRevealed']);

    const draw = unwrap(dealerStep(reveal.round, context));

    expect(draw.round.phase).toBe('dealerTurn');
    expect(draw.events.map(({ type }) => type)).toEqual(['dealerCard']);

    const settle = unwrap(dealerStep(draw.round, context));

    expect(settle.round.phase).toBe('settled');
    expect(settle.events.map(({ type }) => type)).toEqual(['settled']);
  });

  it('settles without drawing when no hand is left to beat the dealer', () => {
    const { round } = start({
      seats: [['10', '6']],
      dealer: ['10', '6'],
      draws: ['K'],
    });
    const { round: waiting } = unwrap(
      applyAction(round, { seat: 0, type: 'hit' }, context),
    );

    expect(waiting.phase).toBe('dealerTurn');

    const reveal = unwrap(dealerStep(waiting, context));
    const settle = unwrap(dealerStep(reveal.round, context));

    expect(reveal.events.map(({ type }) => type)).toEqual(['holeCardRevealed']);
    expect(settle.round.phase).toBe('settled');
    expect(settle.round.results[0]?.outcome).toBe('lose');
  });

  it('refuses a step outside the dealer phase', () => {
    const { round } = start({ seats: [['10', '9']], dealer: ['10', '6'] });

    expect(dealerStep(round, context)).toMatchObject({
      ok: false,
      error: { code: 'ROUND_FINISHED' },
    });
  });
});
