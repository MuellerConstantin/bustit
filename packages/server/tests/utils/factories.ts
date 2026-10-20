import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AccountService, AuthTokenService } from '../../src/auth/index.js';
import { type CreatedInvite, InvitesService } from '../../src/invites/index.js';
import { type User, users } from '../../src/users/index.js';
import type { TestApp } from './test-app.js';

/*
 * Test data is created through the app's services rather than inserted
 * directly, so it always satisfies the domain rules, such as every balance
 * being backed by ledger entries.
 */

export const TEST_PASSWORD = 'test-password';

/**
 * Unique across all test files, which run in parallel against one database.
 */
export function uniqueUsername(): string {
  return `u_${randomBytes(6).toString('hex')}`;
}

/** A player with the starting balance. */
export function createPlayer(app: TestApp): Promise<User> {
  return app.get(AccountService).create({
    username: uniqueUsername(),
    password: TEST_PASSWORD,
    role: 'player',
  });
}

/** The admin the app created on startup. */
export async function getAdmin(app: TestApp): Promise<User> {
  const [admin] = await app.db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'));

  if (!admin) {
    throw new Error('The app created no admin on startup');
  }

  return admin;
}

/**
 * An `Authorization` header value for the user, issued like at login, so
 * tests of other routes don't have to log in over HTTP first.
 */
export async function authorizationFor(
  app: TestApp,
  user: Pick<User, 'id' | 'tokenVersion'>,
): Promise<string> {
  const { token } = await app.get(AuthTokenService).createToken(user);
  return `Bearer ${token}`;
}

export const TEST_INVITE_TITLE = 'Test invite';

/** An open invite created by the admin, with its plain code. */
export async function createInvite(
  app: TestApp,
  title = TEST_INVITE_TITLE,
): Promise<CreatedInvite> {
  const admin = await getAdmin(app);
  return app.get(InvitesService).create(admin.id, title);
}
