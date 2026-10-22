import {
  TABLE_MAX_SEATS,
  TABLE_MIN_SEATS,
  TABLE_NAME_MAX_LENGTH,
} from '@bustit/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** The blackjack tables players sit down at. */
export const tables = pgTable(
  'tables',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text().notNull().unique('tables_name_unique'),
    seats: integer().notNull(),
    minBet: bigint({ mode: 'number' }).notNull(),
    maxBet: bigint({ mode: 'number' }).notNull(),
    /**
     * Closed tables keep their row, so the rounds and bookings played at
     * them still refer to it, and so does the name.
     */
    closedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'tables_name_length',
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(TABLE_NAME_MAX_LENGTH))}`,
    ),
    check(
      'tables_seats_range',
      sql`${table.seats} between ${sql.raw(String(TABLE_MIN_SEATS))} and ${sql.raw(String(TABLE_MAX_SEATS))}`,
    ),
    check(
      'tables_bet_range',
      sql`${table.minBet} >= 1 and ${table.maxBet} >= ${table.minBet}`,
    ),
  ],
);

export type Table = typeof tables.$inferSelect;
