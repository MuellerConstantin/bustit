import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from '../../src/auth/index.js';
import { ledger } from '../../src/ledger/index.js';
import { UsernameTakenError, users } from '../../src/users/index.js';
import { DEFAULT_PASSWORD, uniqueUsername } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('AccountService', () => {
  let app: TestApp;
  let service: AccountService;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(AccountService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function findUser(username: string) {
    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  it('creates the user with a hashed password', async () => {
    const username = uniqueUsername();

    const user = await service.create({
      username,
      password: DEFAULT_PASSWORD,
      role: 'player',
    });

    expect(user).toMatchObject({
      username,
      role: 'player',
      tokenVersion: 0,
      disabledAt: null,
    });
    expect(user.passwordHash).not.toContain(DEFAULT_PASSWORD);
    await expect(
      argon2.verify(user.passwordHash, DEFAULT_PASSWORD),
    ).resolves.toBe(true);
  });

  it('books the starting balance', async () => {
    const user = await service.create({
      username: uniqueUsername(),
      password: DEFAULT_PASSWORD,
      role: 'player',
    });

    expect(user.balance).toBe(1000);
    expect((await findUser(user.username))!.balance).toBe(1000);
    expect(
      await app.db.select().from(ledger).where(eq(ledger.userId, user.id)),
    ).toMatchObject([
      { delta: 1000, balanceAfter: 1000, reason: 'signup_bonus' },
    ]);
  });

  it('rejects a username that is taken', async () => {
    const account = {
      username: uniqueUsername(),
      password: DEFAULT_PASSWORD,
      role: 'player',
    } as const;

    await service.create(account);

    await expect(service.create(account)).rejects.toThrow(UsernameTakenError);
  });

  it('rejects a username the database does not accept', async () => {
    await expect(
      service.create({
        username: 'Not Normalized',
        password: DEFAULT_PASSWORD,
        role: 'player',
      }),
    ).rejects.toThrow();
  });

  it('commits and rolls back together with the given transaction', async () => {
    const username = uniqueUsername();

    await expect(
      app.db.transaction(async (tx) => {
        await service.create(
          { username, password: DEFAULT_PASSWORD, role: 'player' },
          tx,
        );
        throw new Error('caller failed');
      }),
    ).rejects.toThrow('caller failed');

    expect(await findUser(username)).toBeUndefined();
  });
});
