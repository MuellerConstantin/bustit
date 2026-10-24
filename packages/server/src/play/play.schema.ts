import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tables } from '../tables/index.js';

/**
 * How a round ended:
 *
 * - `open`: dealt and not settled yet.
 * - `settled`: played to the end, the payouts are booked.
 * - `aborted`: left open when the server stopped, the stakes are refunded.
 */
export const roundStatus = pgEnum('round_status', [
  'open',
  'settled',
  'aborted',
]);

export type RoundStatus = (typeof roundStatus.enumValues)[number];

/**
 * Every round that was dealt, as the id its ledger entries refer to and
 * whether it ended. The round itself lives in the memory of the server, so
 * this is what tells a round that was lost with a restart from one in which
 * every player lost.
 */
export const rounds = pgTable(
  'rounds',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    tableId: uuid()
      .notNull()
      .references(() => tables.id),
    status: roundStatus().notNull().default('open'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('rounds_status_index').on(table.status),
    check(
      'rounds_ended_at_matches_status',
      sql`(${table.status} = 'open') = (${table.endedAt} is null)`,
    ),
  ],
);
