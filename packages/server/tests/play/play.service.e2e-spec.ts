import { createSeededRng } from '@bustit/engine';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsufficientBalanceError,
  LedgerService,
  type LedgerReason,
  ledger,
} from '../../src/ledger/index.js';
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
import { users } from '../../src/users/index.js';
import { createPlayer } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

const TABLE = 'table-1';

/** Every player starts with the starting balance booked as signup bonus. */
const STARTING_BALANCE = 1000;

describe('PlayService', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A service with an open table, dealing from a generator seeded with `seed`. */
  function newService(seed: string): PlayService {
    const service = new PlayService(
      createSeededRng(seed),
      app.db,
      app.get(LedgerService),
    );
    service.openTable(TABLE);

    return service;
  }

  async function balanceOf(userId: string): Promise<number> {
    const [user] = await app.db
      .select({ balance: users.balance })
      .from(users)
      .where(eq(users.id, userId));
    return user!.balance;
  }

  function entriesOf(userId: string, reason: LedgerReason) {
    return app.db
      .select()
      .from(ledger)
      .where(and(eq(ledger.userId, userId), eq(ledger.reason, reason)))
      .orderBy(asc(ledger.createdAt), asc(ledger.id));
  }

  /** What a settled round handed back to the seat, the stakes included. */
  function payoutOf(service: PlayService, seat: number): number {
    const results = service.publicState(TABLE).round?.results ?? [];

    return results
      .filter((result) => result.seat === seat)
      .reduce((sum, { payout }) => sum + payout, 0);
  }

  /** Lets every seat still in the round stand until the round is settled. */
  async function playOut(service: PlayService): Promise<void> {
    for (
      let state = service.publicState(TABLE);
      state.round?.phase === 'playerTurns';
      state = service.publicState(TABLE)
    ) {
      const { seat } = state.round.turn!;
      await service.act(TABLE, state.seats[seat]!, 'stand');
    }
  }

  /*
   * Alice on seat 0 and bob on seat 2 with a round dealt and still to be
   * played. A blackjack can settle a round right away, so seeds are tried
   * until one doesn't.
   */
  async function roundInPlay(stake = 10) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const service = newService(`round-in-play-${attempt}`);
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.sit(TABLE, 2, bob.id);
      await service.startRound(TABLE, [
        { seat: 0, stake },
        { seat: 2, stake },
      ]);

      if (service.publicState(TABLE).round?.phase === 'playerTurns') {
        return { service, alice, bob };
      }
    }

    throw new Error('No seed left a round to play');
  }

  describe('tables', () => {
    it('opens a table with free seats and no round', () => {
      const service = newService('tables');

      expect(service.publicState(TABLE)).toEqual({
        seats: Array.from({ length: SEATS_PER_TABLE }, () => null),
        round: null,
      });
    });

    it('rejects opening a table twice', () => {
      const service = newService('tables');

      expect(() => service.openTable(TABLE)).toThrow(TableAlreadyOpenError);
    });

    it('rejects every call for a table that is not open', async () => {
      const service = newService('tables');

      await expect(service.sit('unknown', 0, 'alice')).rejects.toThrow(
        TableNotOpenError,
      );
      await expect(service.closeTable('unknown')).rejects.toThrow(
        TableNotOpenError,
      );
      expect(() => service.publicState('unknown')).toThrow(TableNotOpenError);
    });

    it('forgets a closed table', async () => {
      const service = newService('tables');

      await service.closeTable(TABLE);

      expect(() => service.publicState(TABLE)).toThrow(TableNotOpenError);
    });
  });

  describe('seats', () => {
    it('seats users and frees the seat when they leave', async () => {
      const service = newService('seats');

      await service.sit(TABLE, 0, 'alice');
      await service.sit(TABLE, 2, 'bob');

      expect(service.publicState(TABLE).seats).toEqual([
        'alice',
        null,
        'bob',
        null,
        null,
      ]);

      await service.leave(TABLE, 'alice');

      expect(service.publicState(TABLE).seats[0]).toBeNull();
    });

    it('rejects a taken seat', async () => {
      const service = newService('seats');

      await service.sit(TABLE, 0, 'alice');

      await expect(service.sit(TABLE, 0, 'bob')).rejects.toThrow(
        SeatTakenError,
      );
    });

    it('rejects a user who already sits at the table', async () => {
      const service = newService('seats');

      await service.sit(TABLE, 0, 'alice');

      await expect(service.sit(TABLE, 1, 'alice')).rejects.toThrow(
        AlreadySeatedError,
      );
    });

    it.each([-1, SEATS_PER_TABLE, 1.5])(
      'rejects the seat %s',
      async (seat) => {
        const service = newService('seats');

        await expect(service.sit(TABLE, seat, 'alice')).rejects.toThrow(
          RangeError,
        );
      },
    );

    it('rejects leaving for a user who does not sit at the table', async () => {
      const service = newService('seats');

      await expect(service.leave(TABLE, 'alice')).rejects.toThrow(
        NotSeatedError,
      );
    });
  });

  describe('rounds', () => {
    it('deals to the seats with a bet and keeps the shoe away from clients', async () => {
      const service = newService('deal');
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.sit(TABLE, 2, bob.id);

      const events = await service.startRound(TABLE, [
        { seat: 0, stake: 10 },
        { seat: 2, stake: 20 },
      ]);
      const { round } = service.publicState(TABLE);

      expect(events.some(({ type }) => type === 'playerCard')).toBe(true);
      expect(round?.seats.map(({ seat }) => seat)).toEqual([0, 2]);
      expect(round).not.toHaveProperty('shoe');
      expect(round?.cardsRemaining).toBeGreaterThan(0);
    });

    it('rejects a bet on a free seat', async () => {
      const service = newService('free-seat');

      await expect(
        service.startRound(TABLE, [{ seat: 1, stake: 10 }]),
      ).rejects.toThrow(SeatEmptyError);
      expect(service.publicState(TABLE).round).toBeNull();
    });

    it('rejects bets the engine does not accept and books nothing', async () => {
      const service = newService('bad-bets');
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);

      await expect(
        service.startRound(TABLE, [{ seat: 0, stake: 0 }]),
      ).rejects.toThrow(RoundRejectedError);
      await expect(service.startRound(TABLE, [])).rejects.toThrow(
        RoundRejectedError,
      );
      expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE);
    });

    it('rejects an action from a user without a seat', async () => {
      const { service } = await roundInPlay();

      await expect(service.act(TABLE, 'carol', 'stand')).rejects.toThrow(
        NotSeatedError,
      );
    });

    it('rejects an action without a round', async () => {
      const service = newService('no-round');
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);

      await expect(service.act(TABLE, alice.id, 'stand')).rejects.toThrow(
        RoundRejectedError,
      );
    });

    it('keeps the round unchanged when the engine rejects an action', async () => {
      const { service, alice, bob } = await roundInPlay();
      const before = service.publicState(TABLE);
      const other = before.round!.turn!.seat === 0 ? bob : alice;

      await expect(service.act(TABLE, other.id, 'stand')).rejects.toMatchObject(
        { code: 'NOT_YOUR_TURN' },
      );
      expect(service.publicState(TABLE)).toEqual(before);
    });

    it('rejects leaving, closing and a second round while one is played', async () => {
      const { service, alice } = await roundInPlay();

      await expect(service.leave(TABLE, alice.id)).rejects.toThrow(
        RoundInProgressError,
      );
      await expect(service.closeTable(TABLE)).rejects.toThrow(
        RoundInProgressError,
      );
      await expect(
        service.startRound(TABLE, [{ seat: 0, stake: 10 }]),
      ).rejects.toThrow(RoundInProgressError);
    });

    it('lets only one of two simultaneous actions through', async () => {
      const { service, alice, bob } = await roundInPlay();
      const { seat } = service.publicState(TABLE).round!.turn!;
      const player = seat === 0 ? alice : bob;

      const results = await Promise.allSettled([
        service.act(TABLE, player.id, 'stand'),
        service.act(TABLE, player.id, 'stand'),
      ]);

      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
        1,
      );
    });
  });

  describe('bookings', () => {
    it('books the stakes at the start and the payout at the settlement', async () => {
      const { service, alice, bob } = await roundInPlay();

      expect(await entriesOf(alice.id, 'bet')).toMatchObject([{ delta: -10 }]);
      expect(await entriesOf(bob.id, 'bet')).toMatchObject([{ delta: -10 }]);
      expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE - 10);

      await playOut(service);

      const payout = payoutOf(service, 0);

      expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE - 10 + payout);
      expect(await entriesOf(alice.id, 'payout')).toMatchObject(
        payout > 0 ? [{ delta: payout }] : [],
      );
    });

    it('books a lost stake without a payout entry', async () => {
      /*
       * Seeds are tried until the dealer wins against alice, whose hand
       * stands as dealt.
       */
      for (let attempt = 0; attempt < 50; attempt++) {
        const service = newService(`lost-stake-${attempt}`);
        const alice = await createPlayer(app);

        await service.sit(TABLE, 0, alice.id);
        await service.startRound(TABLE, [{ seat: 0, stake: 10 }]);
        await playOut(service);

        if (payoutOf(service, 0) > 0) {
          continue;
        }

        expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE - 10);
        expect(await entriesOf(alice.id, 'payout')).toEqual([]);
        return;
      }

      throw new Error('No seed made alice lose');
    });

    it('rejects bets beyond a balance and books none of them', async () => {
      const service = newService('too-high-bet');
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.sit(TABLE, 2, bob.id);

      await expect(
        service.startRound(TABLE, [
          { seat: 0, stake: 10 },
          { seat: 2, stake: STARTING_BALANCE + 1 },
        ]),
      ).rejects.toThrow(InsufficientBalanceError);

      expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE);
      expect(await balanceOf(bob.id)).toBe(STARTING_BALANCE);
      expect(service.publicState(TABLE).round).toBeNull();
    });

    it('books the extra stake of a double', async () => {
      const { service, alice, bob } = await roundInPlay();
      const { seat } = service.publicState(TABLE).round!.turn!;
      const player = seat === 0 ? alice : bob;

      await service.act(TABLE, player.id, 'double');

      expect(await entriesOf(player.id, 'bet')).toMatchObject([
        { delta: -10 },
        { delta: -10 },
      ]);

      await playOut(service);

      expect(await balanceOf(player.id)).toBe(
        STARTING_BALANCE - 20 + payoutOf(service, seat),
      );
    });

    it('rejects a double beyond the balance and keeps the round', async () => {
      const { service, alice, bob } = await roundInPlay(600);
      const before = service.publicState(TABLE);
      const player = before.round!.turn!.seat === 0 ? alice : bob;

      await expect(service.act(TABLE, player.id, 'double')).rejects.toThrow(
        InsufficientBalanceError,
      );

      expect(await entriesOf(player.id, 'bet')).toHaveLength(1);
      expect(await balanceOf(player.id)).toBe(STARTING_BALANCE - 600);
      expect(service.publicState(TABLE)).toEqual(before);
    });

    it('deals the next round once the previous one is settled', async () => {
      const { service, alice } = await roundInPlay();

      await playOut(service);
      await service.startRound(TABLE, [{ seat: 0, stake: 10 }]);

      expect(await entriesOf(alice.id, 'bet')).toHaveLength(2);
    });
  });
});
