import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, sql, sum } from 'drizzle-orm';
import type { Database } from '../infrastructure/database/index.js';
import { LedgerService, ledger } from '../ledger/index.js';
import { rounds } from './play.schema.js';

/**
 * Refunds the stakes of rounds that were still open when the server stopped.
 * A round only lives in memory, so after a restart nobody can play it on,
 * while its stakes are booked already.
 */
@Injectable()
export class RoundRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoundRecoveryService.name);

  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  /** Runs before the server accepts connections. */
  async onApplicationBootstrap(): Promise<void> {
    const aborted = await this.refundOpenRounds();

    if (aborted > 0) {
      this.logger.warn(
        `Refunded the stakes of ${aborted} rounds left open by the last run`,
      );
    }
  }

  /**
   * Aborts every open round and credits each user the stakes they put into
   * it, double and split stakes included. A round is aborted and refunded in
   * one transaction, so a failure leaves it open for the next try.
   *
   * @returns How many rounds were aborted.
   */
  async refundOpenRounds(): Promise<number> {
    const open = await this.db
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.status, 'open'));

    for (const { id } of open) {
      await this.db.transaction(async (tx) => {
        const [aborted] = await tx
          .update(rounds)
          .set({ status: 'aborted', endedAt: sql`now()` })
          .where(and(eq(rounds.id, id), eq(rounds.status, 'open')))
          .returning({ id: rounds.id });

        if (!aborted) {
          return;
        }

        const stakes = await tx
          .select({ userId: ledger.userId, total: sum(ledger.delta) })
          .from(ledger)
          .where(and(eq(ledger.ref, id), eq(ledger.reason, 'bet')))
          .groupBy(ledger.userId);

        for (const { userId, total } of stakes) {
          const refund = -Number(total);

          if (refund > 0) {
            await this.ledger.book(
              { userId, delta: refund, reason: 'refund', ref: id },
              tx,
            );
          }
        }
      });
    }

    return open.length;
  }
}
