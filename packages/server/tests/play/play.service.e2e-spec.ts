import { createSeededRng } from '@bustit/engine';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  InsufficientBalanceError,
  LedgerService,
  type LedgerReason,
  ledger,
} from '../../src/ledger/index.js';
import {
  AlreadySeatedError,
  BetOutOfLimitsError,
  InvalidSeatError,
  NotSeatedError,
  PlayService,
  type PlayTimings,
  RoundInProgressError,
  RoundRejectedError,
  SeatedElsewhereError,
  SeatEmptyError,
  SeatTakenError,
  TableAlreadyOpenError,
  type TableConfig,
  TableNotOpenError,
} from '../../src/play/index.js';
import { TablesService } from '../../src/tables/index.js';
import { users } from '../../src/users/index.js';
import { createPlayer, createTable } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

/** The id of a table row, which the rounds played at it refer to. */
let TABLE = '';

const TABLE_CONFIG: TableConfig = { seats: 5, minBet: 5, maxBet: 10_000 };

/** Timers that never fire within a test. */
const QUIET: PlayTimings = { betWindowMs: 60_000, turnMs: 60_000 };

/** Every player starts with the starting balance booked as signup bonus. */
const STARTING_BALANCE = 1000;

describe('PlayService', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    TABLE = (await createTable(app)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const services: PlayService[] = [];

  afterEach(() => {
    for (const service of services.splice(0)) {
      service.onModuleDestroy();
    }
  });

  /** A service with an open table, dealing from a generator seeded with `seed`. */
  function newService(seed: string, timings = QUIET): PlayService {
    const service = new PlayService(
      createSeededRng(seed),
      app.db,
      app.get(LedgerService),
      app.get(TablesService),
      timings,
    );
    services.push(service);
    service.openTable(TABLE, TABLE_CONFIG);

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

  /** Waits until the condition holds, for things the timers do on their own. */
  async function eventually(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 5000;

    while (!condition()) {
      if (Date.now() > deadline) {
        throw new Error('The condition did not hold in time');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /*
   * Alice on seat 0 and bob on seat 2 with a round dealt and still to be
   * played. A blackjack can settle a round right away, so seeds are tried
   * until one doesn't.
   */
  async function roundInPlay(stake = 10, timings = QUIET) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const service = newService(`round-in-play-${attempt}`, timings);
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
        seats: Array.from({ length: TABLE_CONFIG.seats }, () => null),
        bets: [],
        round: null,
        deadline: null,
      });
    });

    it('rejects opening a table twice', () => {
      const service = newService('tables');

      expect(() => service.openTable(TABLE, TABLE_CONFIG)).toThrow(
        TableAlreadyOpenError,
      );
    });

    it('opens a created table with its seats and keeps it open', async () => {
      const service = newService('tables');
      const table = await createTable(app, { seats: 3 });

      await service.ensureOpen(table.id);
      await service.ensureOpen(table.id);

      expect(service.publicState(table.id).seats).toHaveLength(3);
    });

    it('does not open a table that does not exist', async () => {
      const service = newService('tables');

      await expect(
        service.ensureOpen('00000000-0000-7000-8000-000000000000'),
      ).rejects.toThrow(TableNotOpenError);
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

    it('rejects a user who sits at another table until the seat is given up', async () => {
      const service = newService('seats');

      service.openTable('other', TABLE_CONFIG);
      await service.sit(TABLE, 0, 'alice');

      await expect(service.sit('other', 0, 'alice')).rejects.toThrow(
        SeatedElsewhereError,
      );

      await service.leave(TABLE, 'alice');
      await service.sit('other', 0, 'alice');

      expect(service.publicState('other').seats[0]).toBe('alice');
    });

    it.each([-1, TABLE_CONFIG.seats, 1.5])(
      'rejects the seat %s',
      async (seat) => {
        const service = newService('seats');

        await expect(service.sit(TABLE, seat, 'alice')).rejects.toThrow(
          InvalidSeatError,
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
        service.startRound(TABLE, [
          { seat: 0, stake: 10 },
          { seat: 0, stake: 10 },
        ]),
      ).rejects.toThrow(RoundRejectedError);
      await expect(service.startRound(TABLE, [])).rejects.toThrow(
        RoundRejectedError,
      );
      expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE);
    });

    it('rejects stakes outside the limits of the table', async () => {
      const service = newService('limits');
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);

      for (const stake of [TABLE_CONFIG.minBet - 1, TABLE_CONFIG.maxBet + 1]) {
        await expect(
          service.startRound(TABLE, [{ seat: 0, stake }]),
        ).rejects.toThrow(BetOutOfLimitsError);
      }

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

      expect(
        results.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
    });
  });

  describe('bets', () => {
    it('keeps the placed bets in seat order and replaces an earlier one', async () => {
      const service = newService('bets');

      await service.sit(TABLE, 3, 'bob');
      await service.sit(TABLE, 1, 'alice');
      await service.placeBet(TABLE, 'bob', 20);
      await service.placeBet(TABLE, 'alice', 10);
      await service.placeBet(TABLE, 'alice', 15);

      expect(service.publicState(TABLE).bets).toEqual([
        { seat: 1, stake: 15 },
        { seat: 3, stake: 20 },
      ]);
    });

    it('rejects a bet outside the limits or from a user without a seat', async () => {
      const service = newService('bets');

      await service.sit(TABLE, 0, 'alice');

      await expect(service.placeBet(TABLE, 'alice', 4)).rejects.toThrow(
        BetOutOfLimitsError,
      );
      await expect(service.placeBet(TABLE, 'alice', 10_001)).rejects.toThrow(
        BetOutOfLimitsError,
      );
      await expect(service.placeBet(TABLE, 'bob', 10)).rejects.toThrow(
        NotSeatedError,
      );
    });

    it('drops the bet of a user who leaves', async () => {
      const service = newService('bets');

      await service.sit(TABLE, 0, 'alice');
      await service.placeBet(TABLE, 'alice', 10);
      await service.leave(TABLE, 'alice');

      expect(service.publicState(TABLE).bets).toEqual([]);
    });

    it('deals the placed bets, books them and clears them', async () => {
      const service = newService('deal-bets');
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.sit(TABLE, 2, bob.id);
      await service.placeBet(TABLE, alice.id, 10);
      await service.placeBet(TABLE, bob.id, 25);
      await service.dealRound(TABLE, alice.id);

      const state = service.publicState(TABLE);

      expect(state.bets).toEqual([]);
      expect(state.round?.seats.map(({ seat }) => seat)).toEqual([0, 2]);
      expect(await entriesOf(alice.id, 'bet')).toMatchObject([{ delta: -10 }]);
      expect(await entriesOf(bob.id, 'bet')).toMatchObject([{ delta: -25 }]);
    });

    it('rejects dealing without a bet or for a user without a seat', async () => {
      const service = newService('deal-bets');
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);

      await expect(service.dealRound(TABLE, alice.id)).rejects.toThrow(
        RoundRejectedError,
      );
      await expect(service.dealRound(TABLE, 'carol')).rejects.toThrow(
        NotSeatedError,
      );
    });

    it('drops a bet the balance does not cover so the others can be dealt', async () => {
      const service = newService('deal-bets');
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.sit(TABLE, 2, bob.id);
      await service.placeBet(TABLE, alice.id, 10);
      await service.placeBet(TABLE, bob.id, STARTING_BALANCE + 1);

      await expect(service.dealRound(TABLE, alice.id)).rejects.toThrow(
        InsufficientBalanceError,
      );

      expect(service.publicState(TABLE).bets).toEqual([{ seat: 0, stake: 10 }]);
      expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE);

      await service.dealRound(TABLE, alice.id);

      expect(service.publicState(TABLE).round?.seats).toHaveLength(1);
    });
  });

  describe('timers', () => {
    const FAST: PlayTimings = { betWindowMs: 100, turnMs: 300 };

    it('runs a betting window once someone sits and deals the bets when it ends', async () => {
      const service = newService('betting-window', FAST);
      const alice = await createPlayer(app);
      const dealt: boolean[] = [];

      service.onChange(({ events }) => dealt.push(!!events));

      expect(service.publicState(TABLE).deadline).toBeNull();

      await service.sit(TABLE, 0, alice.id);

      expect(service.publicState(TABLE).deadline).not.toBeNull();

      await service.placeBet(TABLE, alice.id, 10);
      await eventually(() => service.publicState(TABLE).round !== null);

      expect(service.publicState(TABLE).bets).toEqual([]);
      expect(await entriesOf(alice.id, 'bet')).toMatchObject([{ delta: -10 }]);
      expect(dealt).toContain(true);
    });

    it('does not deal when the bets are gone before the window ends', async () => {
      const service = newService('betting-window', FAST);
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.placeBet(TABLE, alice.id, 10);
      await service.leave(TABLE, alice.id);

      expect(service.publicState(TABLE).deadline).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(service.publicState(TABLE).round).toBeNull();
    });

    it('starts the next window when one ends without bets', async () => {
      const service = newService('betting-window', FAST);
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);

      const first = service.publicState(TABLE).deadline;

      await eventually(() => service.publicState(TABLE).deadline !== first);

      const state = service.publicState(TABLE);

      expect(state.deadline).not.toBeNull();
      expect(state.seats[0]).toBe(alice.id);
      expect(state.round).toBeNull();
    });

    it('frees the seat of a user who sits out three windows in a row', async () => {
      const service = newService('betting-window', FAST);
      const alice = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await eventually(() => service.publicState(TABLE).seats[0] === null);

      expect(service.publicState(TABLE).deadline).toBeNull();
    });

    it('keeps the seat of a user who bets, while the one who sits out loses it', async () => {
      const service = newService('betting-window', FAST);
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.sit(TABLE, 0, alice.id);
      await service.sit(TABLE, 2, bob.id);

      /* Alice bets in every window, bob never does. */
      const giveUp = Date.now() + 5000;

      while (service.publicState(TABLE).seats[2] !== null) {
        if (Date.now() > giveUp) {
          throw new Error('Bob kept his seat');
        }

        if (service.publicState(TABLE).round?.phase !== 'playerTurns') {
          await service.placeBet(TABLE, alice.id, 10).catch(() => undefined);
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(service.publicState(TABLE).seats[0]).toBe(alice.id);
    });

    it('sends a stand to every seat that lets its turn run out', async () => {
      const { service, alice, bob } = await roundInPlay(10, FAST);

      expect(service.publicState(TABLE).deadline).not.toBeNull();

      await eventually(
        () => service.publicState(TABLE).round?.phase === 'settled',
      );

      for (const [seat, player] of [
        [0, alice],
        [2, bob],
      ] as const) {
        expect(await balanceOf(player.id)).toBe(
          STARTING_BALANCE - 10 + payoutOf(service, seat),
        );
      }
    });

    it('gives the next seat its own time after a seat acted', async () => {
      const { service, alice, bob } = await roundInPlay(10, {
        betWindowMs: 60_000,
        turnMs: 400,
      });
      const { seat } = service.publicState(TABLE).round!.turn!;

      await service.act(TABLE, seat === 0 ? alice.id : bob.id, 'stand');

      const { round } = service.publicState(TABLE);

      await new Promise((resolve) => setTimeout(resolve, 150));

      // The timer of the seat that acted must not stand the next one.
      expect(service.publicState(TABLE).round?.turn).toEqual(round?.turn);
    });
  });

  describe('absence', () => {
    it('frees the seat and the bet of an absent user between rounds', async () => {
      const service = newService('absence');

      await service.sit(TABLE, 0, 'alice');
      await service.placeBet(TABLE, 'alice', 10);
      await service.absent(TABLE, 'alice');

      const state = service.publicState(TABLE);

      expect(state.seats[0]).toBeNull();
      expect(state.bets).toEqual([]);
      expect(state.deadline).toBeNull();
    });

    it('plays on for an absent user and frees the seat after the round', async () => {
      const { service, alice, bob } = await roundInPlay();

      await service.absent(TABLE, alice.id);

      // Alice's hand is stood at once, bob takes his time.
      await eventually(() => {
        const { round } = service.publicState(TABLE);
        return round?.phase === 'settled' || round?.turn?.seat === 2;
      });
      await playOut(service);

      expect(service.publicState(TABLE).seats).toEqual([
        null,
        null,
        bob.id,
        null,
        null,
      ]);
      expect(await balanceOf(alice.id)).toBe(
        STARTING_BALANCE - 10 + payoutOf(service, 0),
      );
    });

    it('keeps the seat of a user who is back before the round ends', async () => {
      const { service, alice } = await roundInPlay();

      await service.absent(TABLE, alice.id);
      await service.present(TABLE, alice.id);
      await playOut(service);

      expect(service.publicState(TABLE).seats[0]).toBe(alice.id);
    });

    it('ignores a user who does not sit at the table', async () => {
      const service = newService('absence');

      await expect(service.absent(TABLE, 'alice')).resolves.toBeUndefined();
    });

    it('lists the tables a user sits at', async () => {
      const service = newService('absence');

      await service.sit(TABLE, 0, 'alice');

      expect(service.tablesOf('alice')).toEqual([TABLE]);
      expect(service.tablesOf('bob')).toEqual([]);
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
