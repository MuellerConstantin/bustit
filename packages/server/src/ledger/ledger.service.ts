import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gte, sql } from 'drizzle-orm';
import type {
  Database,
  Transaction,
} from '../infrastructure/database/index.js';
import { users } from '../users/index.js';
import { InsufficientBalanceError } from './ledger.errors.js';
import { type LedgerReason, ledger } from './ledger.schema.js';

export type Booking = {
  readonly userId: string;
  /** Positive to credit, negative to debit, in whole Bucks. */
  readonly delta: number;
  readonly reason: LedgerReason;
  readonly ref?: string;
};

/** The only way to change a balance. */
@Injectable()
export class LedgerService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  /**
   * Changes the balance and records the entry atomically, and returns the new
   * balance. Runs inside `tx` when given, so it commits or rolls back together
   * with the caller's other changes, otherwise in a transaction of its own.
   *
   * @throws InsufficientBalanceError if a debit exceeds the balance.
   */
  async book(booking: Booking, tx?: Transaction): Promise<number> {
    const { userId, delta, reason, ref } = booking;

    if (!Number.isSafeInteger(delta) || delta === 0) {
      throw new RangeError(`delta must be a non-zero integer, got ${delta}`);
    }

    if (!tx) {
      return this.db.transaction((ownTx) => this.book(booking, ownTx));
    }

    /*
     * Checking and changing the balance in one statement keeps concurrent
     * bookings safe: Postgres locks the row and evaluates the condition again
     * against the latest balance once a concurrent update has committed.
     */
    const [updated] = await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${delta}` })
      .where(
        and(eq(users.id, userId), gte(sql`${users.balance} + ${delta}`, 0)),
      )
      .returning({ balance: users.balance });

    if (!updated) {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error(`No user ${userId}`);
      }

      throw new InsufficientBalanceError(userId, delta);
    }

    await tx.insert(ledger).values({
      userId,
      delta,
      balanceAfter: updated.balance,
      reason,
      ref,
    });

    return updated.balance;
  }
}
