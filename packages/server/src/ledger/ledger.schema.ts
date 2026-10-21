import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../users/index.js';

/**
 * Why a balance changed:
 *
 * - `signup_bonus`: credit of the starting balance when an account is created.
 * - `bet`: debit of a stake on the user's own seat, when betting and again for
 *   the extra stake of a double or a split.
 * - `backbet`: debit of a stake on another player's seat.
 * - `payout`: credit after a round is settled, stake included, for bets and
 *   backbets alike. A lost stake gets no entry.
 * - `refund`: credit of stakes back when a round is aborted, e.g. by a
 *   server restart.
 * - `daily_bonus`: credit of the daily bonus.
 * - `rebuy`: credit of fresh Bucks to a user who ran out.
 * - `admin_adjust`: correction by an admin, credit or debit.
 */
export const ledgerReason = pgEnum('ledger_reason', [
  'signup_bonus',
  'bet',
  'backbet',
  'payout',
  'refund',
  'daily_bonus',
  'rebuy',
  'admin_adjust',
]);

export type LedgerReason = (typeof ledgerReason.enumValues)[number];

/** Every change of a balance, never updated or deleted. */
export const ledger = pgTable(
  'ledger',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    delta: bigint({ mode: 'number' }).notNull(),
    balanceAfter: bigint({ mode: 'number' }).notNull(),
    reason: ledgerReason().notNull(),
    /** What the booking belongs to, such as a round, a table or an admin. */
    ref: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ledger_user_id_created_at_index').on(table.userId, table.createdAt),
    check('ledger_delta_not_zero', sql`${table.delta} <> 0`),
  ],
);
