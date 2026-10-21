import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getDrizzleToken } from '@nestjs/drizzle';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module.js';
import { RegistrationService } from '../src/auth/index.js';
import type { Database } from '../src/infrastructure/database/index.js';
import { InvitesService, invites } from '../src/invites/index.js';
import {
  type AppContext,
  DEFAULT_PASSWORD,
  createInvite,
  createPlayer,
} from './factories.js';

const PLAYERS = ['alice', 'bob', 'carol', 'dave'];

/**
 * Fills an empty development database. Usernames are fixed so they can be
 * used to log in, which makes a second run fail on the taken names.
 */
async function seed(app: AppContext, logger: Logger): Promise<void> {
  for (const username of PLAYERS) {
    await createPlayer(app, username);
  }

  const used = await createInvite(app, 'Used invite');
  await app.get(RegistrationService).register({
    inviteCode: used.code,
    username: 'erin',
    password: DEFAULT_PASSWORD,
  });

  const revoked = await createInvite(app, 'Revoked invite');
  await app.get(InvitesService).revoke(revoked.invite.id);

  // Expiry is judged by the database clock, so only a past date expires it.
  const expired = await createInvite(app, 'Expired invite');
  await app.db
    .update(invites)
    .set({ expiresAt: sql`now() - interval '1 second'` })
    .where(eq(invites.id, expired.invite.id));

  const open = await createInvite(app, 'Open invite');

  logger.log(
    `Players ${[...PLAYERS, 'erin'].join(', ')} log in with "${DEFAULT_PASSWORD}"`,
  );
  logger.log(`Open invite code: ${open.code}`);
}

/*
 * An application context starts the modules and their startup hooks, which
 * create the admin, without listening for HTTP requests.
 */
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});

try {
  const db: Database = app.get(getDrizzleToken());
  await seed({ db, get: (type) => app.get(type) }, new Logger('Seed'));
} finally {
  await app.close();
}
