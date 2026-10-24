import { createSeededRng } from '@bustit/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AlreadySeatedError,
  NotSeatedError,
  PlayService,
  RoundInProgressError,
  RoundRejectedError,
  SEATS_PER_TABLE,
  SeatEmptyError,
  SeatTakenError,
  TableAlreadyOpenError,
  TableNotOpenError,
} from '../../src/play/index.js';

const TABLE = 'table-1';

describe('PlayService', () => {
  let service: PlayService;

  beforeEach(() => {
    service = new PlayService(createSeededRng('play-service'));
    service.openTable(TABLE);
  });

  /** Lets every seat still in the round stand until the round is settled. */
  function playOut(): void {
    for (
      let state = service.publicState(TABLE);
      state.round?.phase === 'playerTurns';
      state = service.publicState(TABLE)
    ) {
      const { seat } = state.round.turn!;
      service.act(TABLE, state.seats[seat]!, 'stand');
    }
  }

  describe('tables', () => {
    it('opens a table with free seats and no round', () => {
      expect(service.publicState(TABLE)).toEqual({
        seats: Array.from({ length: SEATS_PER_TABLE }, () => null),
        round: null,
      });
    });

    it('rejects opening a table twice', () => {
      expect(() => service.openTable(TABLE)).toThrow(TableAlreadyOpenError);
    });

    it('rejects every call for a table that is not open', () => {
      expect(() => service.sit('unknown', 0, 'alice')).toThrow(
        TableNotOpenError,
      );
      expect(() => service.publicState('unknown')).toThrow(TableNotOpenError);
      expect(() => service.closeTable('unknown')).toThrow(TableNotOpenError);
    });

    it('forgets a closed table', () => {
      service.closeTable(TABLE);

      expect(() => service.publicState(TABLE)).toThrow(TableNotOpenError);
    });
  });

  describe('seats', () => {
    it('seats users and frees the seat when they leave', () => {
      service.sit(TABLE, 0, 'alice');
      service.sit(TABLE, 2, 'bob');

      expect(service.publicState(TABLE).seats).toEqual([
        'alice',
        null,
        'bob',
        null,
        null,
      ]);

      service.leave(TABLE, 'alice');

      expect(service.publicState(TABLE).seats[0]).toBeNull();
    });

    it('rejects a taken seat', () => {
      service.sit(TABLE, 0, 'alice');

      expect(() => service.sit(TABLE, 0, 'bob')).toThrow(SeatTakenError);
    });

    it('rejects a user who already sits at the table', () => {
      service.sit(TABLE, 0, 'alice');

      expect(() => service.sit(TABLE, 1, 'alice')).toThrow(AlreadySeatedError);
    });

    it.each([-1, SEATS_PER_TABLE, 1.5])('rejects the seat %s', (seat) => {
      expect(() => service.sit(TABLE, seat, 'alice')).toThrow(RangeError);
    });

    it('rejects leaving for a user who does not sit at the table', () => {
      expect(() => service.leave(TABLE, 'alice')).toThrow(NotSeatedError);
    });
  });

  describe('rounds', () => {
    beforeEach(() => {
      service.sit(TABLE, 0, 'alice');
      service.sit(TABLE, 2, 'bob');
    });

    it('deals to the seats with a bet and reports what happened', () => {
      const events = service.startRound(TABLE, [
        { seat: 0, stake: 10 },
        { seat: 2, stake: 20 },
      ]);
      const { round } = service.publicState(TABLE);

      expect(events.some(({ type }) => type === 'playerCard')).toBe(true);
      expect(round?.seats.map(({ seat }) => seat)).toEqual([0, 2]);
    });

    it('keeps the shoe away from clients', () => {
      service.startRound(TABLE, [{ seat: 0, stake: 10 }]);

      const { round } = service.publicState(TABLE);

      expect(round).not.toHaveProperty('shoe');
      expect(round?.cardsRemaining).toBeGreaterThan(0);
    });

    it('rejects a bet on a free seat', () => {
      expect(() => service.startRound(TABLE, [{ seat: 1, stake: 10 }])).toThrow(
        SeatEmptyError,
      );
      expect(service.publicState(TABLE).round).toBeNull();
    });

    it('rejects bets the engine does not accept', () => {
      expect(() => service.startRound(TABLE, [{ seat: 0, stake: 0 }])).toThrow(
        RoundRejectedError,
      );
      expect(() => service.startRound(TABLE, [])).toThrow(RoundRejectedError);
    });

    it('settles a round and deals the next one', () => {
      service.startRound(TABLE, [{ seat: 0, stake: 10 }]);
      playOut();

      expect(service.publicState(TABLE).round?.phase).toBe('settled');

      service.startRound(TABLE, [{ seat: 0, stake: 10 }]);

      expect(service.publicState(TABLE).round?.results).toEqual([]);
    });

    it('rejects an action from a user without a seat', () => {
      service.startRound(TABLE, [{ seat: 0, stake: 10 }]);

      expect(() => service.act(TABLE, 'carol', 'stand')).toThrow(
        NotSeatedError,
      );
    });

    it('rejects an action without a round', () => {
      expect(() => service.act(TABLE, 'alice', 'stand')).toThrow(
        RoundRejectedError,
      );
    });

    it('keeps the round unchanged when the engine rejects an action', () => {
      service.startRound(TABLE, [
        { seat: 0, stake: 10 },
        { seat: 2, stake: 10 },
      ]);

      const before = service.publicState(TABLE);
      const { seat } = before.round!.turn!;
      const other = seat === 0 ? 'bob' : 'alice';

      expect(() => service.act(TABLE, other, 'stand')).toThrow(
        expect.objectContaining({ code: 'NOT_YOUR_TURN' }),
      );
      expect(service.publicState(TABLE)).toEqual(before);
    });

    it('rejects leaving, closing and a second round while one is played', () => {
      service.startRound(TABLE, [
        { seat: 0, stake: 10 },
        { seat: 2, stake: 10 },
      ]);

      expect(() => service.leave(TABLE, 'alice')).toThrow(
        RoundInProgressError,
      );
      expect(() => service.closeTable(TABLE)).toThrow(RoundInProgressError);
      expect(() =>
        service.startRound(TABLE, [{ seat: 0, stake: 10 }]),
      ).toThrow(RoundInProgressError);
    });
  });
});
