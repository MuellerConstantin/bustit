import { asc, eq, sum } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsufficientBalanceError,
  LedgerService,
  ledger,
} from '../../src/ledger/index.js';
import { users } from '../../src/users/index.js';
import { createPlayer } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

/** Every player starts with the starting balance booked as signup bonus. */
const STARTING_BALANCE = 1000;

describe('LedgerService', () => {
  let app: TestApp;
  let service: LedgerService;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(LedgerService);
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

  async function entriesOf(userId: string) {
    return app.db
      .select()
      .from(ledger)
      .where(eq(ledger.userId, userId))
      .orderBy(asc(ledger.createdAt), asc(ledger.id));
  }

  it('credits and debits the balance and records every booking', async () => {
    const { id: userId } = await createPlayer(app);

    await expect(
      service.book({ userId, delta: 500, reason: 'daily_bonus' }),
    ).resolves.toBe(1500);
    await expect(
      service.book({ userId, delta: -250, reason: 'bet', ref: 'round-1' }),
    ).resolves.toBe(1250);

    expect(await balanceOf(userId)).toBe(1250);
    expect(await entriesOf(userId)).toMatchObject([
      { delta: STARTING_BALANCE, balanceAfter: 1000, reason: 'signup_bonus' },
      { delta: 500, balanceAfter: 1500, reason: 'daily_bonus', ref: null },
      { delta: -250, balanceAfter: 1250, reason: 'bet', ref: 'round-1' },
    ]);
  });

  it('rejects a debit beyond the balance and changes nothing', async () => {
    const { id: userId } = await createPlayer(app);

    await expect(
      service.book({ userId, delta: -(STARTING_BALANCE + 1), reason: 'bet' }),
    ).rejects.toThrow(InsufficientBalanceError);

    expect(await balanceOf(userId)).toBe(STARTING_BALANCE);
    expect(await entriesOf(userId)).toHaveLength(1);
  });

  it('allows a debit down to exactly zero', async () => {
    const { id: userId } = await createPlayer(app);

    await expect(
      service.book({ userId, delta: -STARTING_BALANCE, reason: 'bet' }),
    ).resolves.toBe(0);
  });

  it.each([0, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a delta of %s',
    async (delta) => {
      const { id: userId } = await createPlayer(app);

      await expect(
        service.book({ userId, delta, reason: 'admin_adjust' }),
      ).rejects.toThrow(RangeError);
    },
  );

  it('fails for an unknown user', async () => {
    await expect(
      service.book({
        userId: '00000000-0000-7000-8000-000000000000',
        delta: 100,
        reason: 'admin_adjust',
      }),
    ).rejects.toThrow('No user');
  });

  it('commits and rolls back together with the given transaction', async () => {
    const { id: userId } = await createPlayer(app);

    await expect(
      app.db.transaction(async (tx) => {
        await service.book({ userId, delta: 500, reason: 'admin_adjust' }, tx);
        throw new Error('caller failed');
      }),
    ).rejects.toThrow('caller failed');

    expect(await balanceOf(userId)).toBe(STARTING_BALANCE);
    expect(await entriesOf(userId)).toHaveLength(1);

    await app.db.transaction(async (tx) => {
      await service.book({ userId, delta: 500, reason: 'admin_adjust' }, tx);
    });

    expect(await balanceOf(userId)).toBe(STARTING_BALANCE + 500);
  });

  it('never overdraws under concurrent debits', async () => {
    const { id: userId } = await createPlayer(app);

    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () =>
        service.book({ userId, delta: -100, reason: 'bet' }),
      ),
    );

    const succeeded = results.filter(({ status }) => status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(succeeded).toHaveLength(10);
    expect(
      rejected.every(
        ({ reason }) => reason instanceof InsufficientBalanceError,
      ),
    ).toBe(true);
    expect(await balanceOf(userId)).toBe(0);

    const balancesAfter = (await entriesOf(userId))
      .map(({ balanceAfter }) => balanceAfter)
      .sort((a, b) => b - a);
    expect(balancesAfter).toEqual([
      1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0,
    ]);
  });

  it('keeps the balance equal to the sum of the ledger', async () => {
    const { id: userId } = await createPlayer(app);

    for (const delta of [1000, -300, 450, -1150, 20, -20, 5]) {
      await service.book({ userId, delta, reason: 'admin_adjust' });
    }

    const [{ total }] = (await app.db
      .select({ total: sum(ledger.delta).mapWith(Number) })
      .from(ledger)
      .where(eq(ledger.userId, userId))) as [{ total: number }];

    expect(await balanceOf(userId)).toBe(total);
    expect(total).toBe(STARTING_BALANCE + 5);
  });
});
