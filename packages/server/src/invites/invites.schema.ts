import { INVITE_TITLE_MAX_LENGTH } from '@bustit/shared';
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../users/index.js';

/** Single-use codes that let someone create an account. */
export const invites = pgTable(
  'invites',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** SHA-256 of the normalized code; the code itself is never stored. */
    codeHash: text().notNull().unique('invites_code_hash_unique'),
    title: text().notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    usedBy: uuid().references(() => users.id),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check(
      'invites_title_length',
      sql`char_length(${table.title}) between 1 and ${sql.raw(String(INVITE_TITLE_MAX_LENGTH))}`,
    ),
    check(
      'invites_used_at_and_by_together',
      sql`(${table.usedAt} is null) = (${table.usedBy} is null)`,
    ),
    check(
      'invites_not_used_and_revoked',
      sql`${table.usedAt} is null or ${table.revokedAt} is null`,
    ),
  ],
);

export type Invite = typeof invites.$inferSelect;
