import { createSeededRng } from '@bustit/engine';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LedgerService, ledger } from '../../src/ledger/index.js';
import {
  PlayService,
  RoundRecoveryService,
  rounds,
} from '../../src/play/index.js';
import { TablesService } from '../../src/tables/index.js';
import { type User, users } from '../../src/users/index.js';
import { createPlayer, createTable } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

/** Every player starts with the starting balance booked as signup bonus. */
const STARTING_BALANCE = 1000;

describe('RoundRecoveryService', () => {
  let app: TestApp;
  let recovery: RoundRecoveryService;
  const services: PlayService[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    recovery = new RoundRecoveryService(app.db, app.get(LedgerService));
  });

  afterEach(() => {
    for (const service of services.splice(0)) {
      service.onModuleDestroy();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function balanceOf(userId: string): Promise<number> {
    const [user] = await app.db
      .select({ balance: users.balance })
      .from(users)
      .where(eq(users.id, userId));
    return user!.balance;
  }

  async function roundsOf(tableId: string) {
    return app.db.select().from(rounds).where(eq(rounds.tableId, tableId));
  }

  /*
   * Alice on seat 0 and bob on seat 2 with a round dealt and still to be
   * played, at a table of their own. A blackjack can settle a round right
   * away, so seeds are tried until one doesn't.
   */
  async function roundInPlay() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const service = new PlayService(
        createSeededRng(`recovery-${attempt}`),
        app.db,
        app.get(LedgerService),
        app.get(TablesService),
        {
          betWindowMs: 60_000,
          turnMs: 60_000,
          reconnectMs: 60_000,
        },
      );
      services.push(service);

      const table = await createTable(app);
      const alice = await createPlayer(app);
      const bob = await createPlayer(app);

      await service.ensureOpen(table.id);
      await service.sit(table.id, 0, alice.id);
      await service.sit(table.id, 2, bob.id);
      await service.startRound(table.id, [
        { seat: 0, stake: 10 },
        { seat: 2, stake: 20 },
      ]);

      if (service.publicState(table.id).round?.phase === 'playerTurns') {
        return { service, table, alice, bob };
      }
    }

    throw new Error('No seed left a round to play');
  }

  async function playOut(service: PlayService, tableId: string) {
    for (
      let state = service.publicState(tableId);
      state.round?.phase === 'playerTurns';
      state = service.publicState(tableId)
    ) {
      await service.act(tableId, state.seats[state.round.turn!.seat]!, 'stand');
    }
  }

  function refundsOf(user: User) {
    return app.db
      .select()
      .from(ledger)
      .where(and(eq(ledger.userId, user.id), eq(ledger.reason, 'refund')));
  }

  it('records a round as open and ends the record when it is settled', async () => {
    const { service, table } = await roundInPlay();

    expect(await roundsOf(table.id)).toMatchObject([
      { status: 'open', endedAt: null },
    ]);

    await playOut(service, table.id);

    const [round] = await roundsOf(table.id);

    expect(round).toMatchObject({ status: 'settled' });
    expect(round?.endedAt).not.toBeNull();
  });

  it('refunds every stake of a round that was left open', async () => {
    const { service, table, alice, bob } = await roundInPlay();
    const { seat } = service.publicState(table.id).round!.turn!;
    const doubler = seat === 0 ? alice : bob;

    await service.act(table.id, doubler.id, 'double');

    await expect(recovery.refundOpenRounds()).resolves.toBeGreaterThanOrEqual(
      1,
    );

    expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE);
    expect(await balanceOf(bob.id)).toBe(STARTING_BALANCE);
    expect(await refundsOf(alice)).toHaveLength(1);
    expect(await refundsOf(bob)).toHaveLength(1);

    const [round] = await roundsOf(table.id);

    expect(round).toMatchObject({ status: 'aborted' });
    expect(round?.endedAt).not.toBeNull();
  });

  it('refunds a round only once', async () => {
    const { alice } = await roundInPlay();

    await recovery.refundOpenRounds();
    await recovery.refundOpenRounds();

    expect(await balanceOf(alice.id)).toBe(STARTING_BALANCE);
    expect(await refundsOf(alice)).toHaveLength(1);
  });

  it('leaves a settled round alone', async () => {
    const { service, table, alice } = await roundInPlay();

    await playOut(service, table.id);

    const balance = await balanceOf(alice.id);

    await recovery.refundOpenRounds();

    expect(await balanceOf(alice.id)).toBe(balance);
    expect(await refundsOf(alice)).toEqual([]);
    expect(await roundsOf(table.id)).toMatchObject([{ status: 'settled' }]);
  });
});
