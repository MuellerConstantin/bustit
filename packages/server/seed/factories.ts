import { randomBytes } from 'node:crypto';
import type { Type } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AccountService } from '../src/auth/index.js';
import type { Database } from '../src/infrastructure/database/index.js';
import { type CreatedInvite, InvitesService } from '../src/invites/index.js';
import { type User, users } from '../src/users/index.js';

/*
 * Data is created through the app's services rather than inserted directly,
 * so it always satisfies the domain rules, such as every balance being
 * backed by ledger entries. The e2e tests and the development seed share
 * these factories.
 */

/** A started app to create data in, e.g. a test app or the seed's context. */
export type AppContext = {
  readonly db: Database;
  get<T>(type: Type<T>): T;
};

export const DEFAULT_PASSWORD = 'test-password';

/**
 * Unique across all test files, which run in parallel against one database.
 */
export function uniqueUsername(): string {
  return `u_${randomBytes(6).toString('hex')}`;
}

/** A player with the starting balance. */
export function createPlayer(
  app: AppContext,
  username = uniqueUsername(),
): Promise<User> {
  return app.get(AccountService).create({
    username,
    password: DEFAULT_PASSWORD,
    role: 'player',
  });
}

/** The admin the app created on startup. */
export async function getAdmin(app: AppContext): Promise<User> {
  const [admin] = await app.db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'));

  if (!admin) {
    throw new Error('The app created no admin on startup');
  }

  return admin;
}

export const DEFAULT_INVITE_TITLE = 'Test invite';

/** An open invite created by the admin, with its plain code. */
export async function createInvite(
  app: AppContext,
  title = DEFAULT_INVITE_TITLE,
): Promise<CreatedInvite> {
  const admin = await getAdmin(app);
  return app.get(InvitesService).create(admin.id, title);
}
