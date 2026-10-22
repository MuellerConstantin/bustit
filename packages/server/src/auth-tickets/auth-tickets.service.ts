import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../infrastructure/database/index.js';
import { authTickets } from './auth-tickets.schema.js';
import { generateAuthTicket, hashAuthTicket } from './auth-ticket.js';

export type CreatedAuthTicket = {
  /** The plain ticket, only available right after creation. */
  readonly ticket: string;
};

@Injectable()
export class AuthTicketsService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  /**
   * Creates a short-lived authentication ticket for a user.
   *
   * The plain ticket is returned only once. Only its hash is stored.
   */
  async issue(userId: string): Promise<CreatedAuthTicket> {
    const ticket = generateAuthTicket();

    await this.db.insert(authTickets).values({
      tokenHash: hashAuthTicket(ticket),
      userId,
      expiresAt: sql`now() + interval '60 seconds'`,
    });

    return { ticket };
  }

  /**
   * Consumes a ticket exactly once and returns its user ID.
   *
   * Expired tickets are rejected. The DELETE is atomic, so concurrent
   * attempts to consume the same ticket cannot both succeed.
   *
   * @returns The authenticated user's ID, or null if the ticket is invalid.
   */
  async consume(ticket: string): Promise<string | null> {
    const tokenHash = hashAuthTicket(ticket);

    const [consumed] = await this.db
      .delete(authTickets)
      .where(
        and(
          eq(authTickets.tokenHash, tokenHash),
          gt(authTickets.expiresAt, sql`now()`),
        ),
      )
      .returning({ userId: authTickets.userId });

    return consumed?.userId ?? null;
  }
}
