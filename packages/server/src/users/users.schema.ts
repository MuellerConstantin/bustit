import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['admin', 'player']);

export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable(
  'users',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** Normalized to lower case, see `usernameSchema` in `@bustit/shared`. */
    username: text().notNull().unique('users_username_unique'),
    passwordHash: text().notNull(),
    role: userRole().notNull().default('player'),
    /**
     * Part of every session token. Raising it invalidates all sessions of the
     * user, e.g. after a password change.
     */
    tokenVersion: integer().notNull().default(0),
    disabledAt: timestamp({ withTimezone: true }),
    /**
     * Deleted users keep their row, so their ledger entries and invites still
     * name them. They can't log in and aren't listed.
     */
    deletedAt: timestamp({ withTimezone: true }),
    /**
     * Cache of the sum of the user's ledger entries. Only the ledger changes
     * it, in the same transaction as the entry.
     */
    balance: bigint({ mode: 'number' }).notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('users_balance_not_negative', sql`${table.balance} >= 0`),
    check(
      'users_username_format',
      sql`${table.username} ~ '^[a-z0-9_]{3,20}$'`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
