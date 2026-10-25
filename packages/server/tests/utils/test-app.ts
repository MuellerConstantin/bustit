import type { INestApplication, Type } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { Database } from '../../src/infrastructure/database/index.js';
import { LedgerModule } from '../../src/ledger/index.js';
import {
  DEFAULT_PLAY_TIMINGS,
  PLAY_TIMINGS,
  type PlayTimings,
} from '../../src/play/index.js';

export type TestApp = {
  readonly db: Database;
  /** The HTTP server, to send requests to with supertest. */
  readonly http: App;
  get<T>(type: Type<T>): T;
  close(): Promise<void>;
};

export type TestAppOptions = {
  /** Extra controllers, e.g. to exercise guards on routes of a test's own. */
  readonly controllers?: Type[];
  /** Timings of the play service that differ from the defaults. */
  readonly playTimings?: Partial<PlayTimings>;
};

/**
 * The app with every feature module, set up as in `main.ts` and started
 * against an emptied e2e database. Its startup hooks run as in production,
 * so afterwards the database holds exactly the admin with its starting
 * balance.
 */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const module = await Test.createTestingModule({
    imports: [AppModule, LedgerModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(PLAY_TIMINGS)
    .useValue({ ...DEFAULT_PLAY_TIMINGS, ...options.playTimings })
    .compile();
  const db: Database = module.get(getDrizzleToken());

  await emptyDatabase(db);

  const app: INestApplication<App> = module.createNestApplication({
    logger: false,
  });
  configureApp(app);
  await app.init();

  return {
    db,
    http: app.getHttpServer(),
    get: (type) => app.get(type),
    close: () => app.close(),
  };
}

/**
 * Empties every table of the app. Drizzle's migration bookkeeping lives in a
 * schema of its own and stays, so the schema doesn't have to be migrated
 * again. Tables are looked up rather than listed, so new ones are covered.
 */
async function emptyDatabase(db: Database): Promise<void> {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );

  if (rows.length === 0) {
    return;
  }

  const tables = rows.map(({ tablename }) => `"public"."${tablename}"`);
  await db.execute(sql.raw(`truncate ${tables.join(', ')} cascade`));
}
