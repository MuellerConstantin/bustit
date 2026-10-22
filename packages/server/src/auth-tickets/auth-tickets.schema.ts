import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from '../users/users.schema.js';

export const authTickets = pgTable(
  'auth_tickets',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    tokenHash: text().notNull().unique('auth_tickets_token_hash_unique'),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('auth_tickets_expires_at_idx').on(table.expiresAt)],
);

export type AuthTicket = typeof authTickets.$inferSelect;
export type NewAuthTicket = typeof authTickets.$inferInsert;
