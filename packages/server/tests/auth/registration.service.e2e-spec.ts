import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RegistrationService } from '../../src/auth/index.js';
import {
  InvalidInviteError,
  InviteUsedError,
  InvitesService,
  hashInviteCode,
  invites,
} from '../../src/invites/index.js';
import { ledger } from '../../src/ledger/index.js';
import { UsernameTakenError, users } from '../../src/users/index.js';
import {
  DEFAULT_PASSWORD,
  createInvite,
  createPlayer,
  uniqueUsername,
} from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('RegistrationService', () => {
  let app: TestApp;
  let service: RegistrationService;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(RegistrationService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function inviteOf(code: string) {
    const [invite] = await app.db
      .select()
      .from(invites)
      .where(eq(invites.codeHash, hashInviteCode(code)));
    return invite!;
  }

  function register(inviteCode: string, username = uniqueUsername()) {
    return service.register({
      inviteCode,
      username,
      password: DEFAULT_PASSWORD,
    });
  }

  it('creates a player with the starting balance and uses up the invite', async () => {
    const { code } = await createInvite(app);
    const username = uniqueUsername();

    const user = await register(code, username);

    expect(user).toMatchObject({ username, role: 'player', balance: 1000 });
    expect(
      await app.db.select().from(ledger).where(eq(ledger.userId, user.id)),
    ).toMatchObject([{ delta: 1000, reason: 'signup_bonus' }]);
    expect(await inviteOf(code)).toMatchObject({ usedBy: user.id });
  });

  it('accepts a code only once', async () => {
    const { code } = await createInvite(app);
    await register(code);

    await expect(register(code)).rejects.toThrow(InvalidInviteError);
  });

  it('keeps the invite valid when the username is taken', async () => {
    const player = await createPlayer(app);
    const { code } = await createInvite(app);

    await expect(register(code, player.username)).rejects.toThrow(
      UsernameTakenError,
    );
    expect(await inviteOf(code)).toMatchObject({ usedAt: null, usedBy: null });

    await expect(register(code)).resolves.toMatchObject({ role: 'player' });
  });

  it('lets only one of concurrent registrations with a code through', async () => {
    const { code } = await createInvite(app);
    const usernames = Array.from({ length: 5 }, () => uniqueUsername());

    const results = await Promise.allSettled(
      usernames.map((username) => register(code, username)),
    );

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        )
        .every(({ reason }) => reason instanceof InvalidInviteError),
    ).toBe(true);
    expect(
      await app.db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.username, usernames)),
    ).toHaveLength(1);
  });

  it('lets either a concurrent registration or a revocation win', async () => {
    const invitesService = app.get(InvitesService);

    for (let attempt = 0; attempt < 10; attempt++) {
      const { invite, code } = await createInvite(app);

      const [registration, revocation] = await Promise.allSettled([
        register(code),
        invitesService.revoke(invite.id),
      ]);
      const stored = await inviteOf(code);

      if (registration.status === 'fulfilled') {
        expect(revocation).toMatchObject({ status: 'rejected' });
        expect((revocation as PromiseRejectedResult).reason).toBeInstanceOf(
          InviteUsedError,
        );
        expect(stored.revokedAt).toBeNull();
      } else {
        expect(registration.reason).toBeInstanceOf(InvalidInviteError);
        expect(revocation.status).toBe('fulfilled');
        expect(stored.usedAt).toBeNull();
      }
    }
  });
});
