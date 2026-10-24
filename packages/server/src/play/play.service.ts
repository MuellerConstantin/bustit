import { randomUUID } from 'node:crypto';
import {
  type ActionType,
  type Bet,
  DEFAULT_RULES,
  type PublicRoundState,
  type Result,
  type Rng,
  type RoundEvent,
  type RoundState,
  type RoundUpdate,
  type Shoe,
  type TableRules,
  applyAction,
  availableActions,
  createShoe,
  publicView,
  startRound,
} from '@bustit/engine';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type {
  Database,
  Transaction,
} from '../infrastructure/database/index.js';
import { LedgerService } from '../ledger/index.js';
import {
  AlreadySeatedError,
  NotSeatedError,
  RoundInProgressError,
  RoundRejectedError,
  SeatEmptyError,
  SeatTakenError,
  TableAlreadyOpenError,
  TableNotOpenError,
} from './play.errors.js';

export const SEATS_PER_TABLE = 5;

/** Injection token of the generator that shuffles the shoes and deals. */
export const ROUND_RNG = Symbol('ROUND_RNG');

/** A round with the id its ledger entries refer to. */
type ActiveRound = {
  readonly id: string;
  readonly state: RoundState;
};

/** What the server keeps per open table: who sits where, the shoe and the round. */
type PlayTable = {
  readonly rules: TableRules;
  /** The user on each seat, `null` for a free seat. */
  readonly seats: (string | null)[];
  shoe: Shoe;
  round: ActiveRound | null;
  /** The calls waiting for their turn, see `exclusive`. */
  queue: Promise<unknown>;
};

/** The table as every client may see it. */
export type PublicTableState = {
  readonly seats: readonly (string | null)[];
  readonly round: PublicRoundState | null;
};

/**
 * Keeps the seats and the current round of every open table in memory. The
 * engine decides the rules, this service checks who may do what, books the
 * stakes and payouts on the ledger and stores the results.
 */
@Injectable()
export class PlayService {
  private readonly tables = new Map<string, PlayTable>();

  constructor(
    @Inject(ROUND_RNG) private readonly rng: Rng,
    @InjectDrizzle() private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  /** @throws TableAlreadyOpenError if the table is open already. */
  openTable(tableId: string, rules: TableRules = DEFAULT_RULES): void {
    if (this.tables.has(tableId)) {
      throw new TableAlreadyOpenError(tableId);
    }

    this.tables.set(tableId, {
      rules,
      seats: Array.from({ length: SEATS_PER_TABLE }, () => null),
      shoe: createShoe(rules, this.rng),
      round: null,
      queue: Promise.resolve(),
    });
  }

  /**
   * @throws TableNotOpenError if the table is not open.
   * @throws RoundInProgressError while a round is being played.
   */
  closeTable(tableId: string): Promise<void> {
    return this.exclusive(tableId, (table) => {
      if (table.round?.state.phase === 'playerTurns') {
        throw new RoundInProgressError(tableId);
      }

      this.tables.delete(tableId);
    });
  }

  /**
   * @throws TableNotOpenError if the table is not open.
   * @throws AlreadySeatedError if the user already sits at the table.
   * @throws SeatTakenError if another user sits on the seat.
   */
  sit(tableId: string, seat: number, userId: string): Promise<void> {
    return this.exclusive(tableId, (table) => {
      assertSeat(seat);

      if (table.seats.includes(userId)) {
        throw new AlreadySeatedError(userId);
      }

      if (table.seats[seat]) {
        throw new SeatTakenError(seat);
      }

      table.seats[seat] = userId;
    });
  }

  /**
   * @throws NotSeatedError if the user does not sit at the table.
   * @throws RoundInProgressError while the user's seat is still in a round.
   */
  leave(tableId: string, userId: string): Promise<void> {
    return this.exclusive(tableId, (table) => {
      const seat = seatOf(table, userId);

      if (table.round?.state.phase === 'playerTurns') {
        throw new RoundInProgressError(tableId);
      }

      table.seats[seat] = null;
    });
  }

  /**
   * Deals a round to the seats with a bet and books the stakes, and the
   * payouts if the round is settled right away. The previous round must be
   * settled.
   *
   * @throws SeatEmptyError if a bet is placed on a free seat.
   * @throws RoundInProgressError while a round is being played.
   * @throws RoundRejectedError if the engine rejects the bets.
   * @throws InsufficientBalanceError if a balance doesn't cover its stake.
   *   Nothing is booked then and the table stays as it was.
   */
  startRound(
    tableId: string,
    bets: readonly Bet[],
  ): Promise<readonly RoundEvent[]> {
    return this.exclusive(tableId, async (table) => {
      if (table.round?.state.phase === 'playerTurns') {
        throw new RoundInProgressError(tableId);
      }

      for (const { seat } of bets) {
        if (!table.seats[seat]) {
          throw new SeatEmptyError(seat);
        }
      }

      const update = unwrap(
        startRound(
          { rules: table.rules, shoe: table.shoe, bets },
          { rng: this.rng },
        ),
      );
      const roundId = randomUUID();

      await this.db.transaction(async (tx) => {
        for (const { seat, stake } of bets) {
          await this.ledger.book(
            {
              userId: table.seats[seat]!,
              delta: -stake,
              reason: 'bet',
              ref: roundId,
            },
            tx,
          );
        }

        await this.payOut(table, update.round, roundId, tx);
      });

      return store(table, roundId, update);
    });
  }

  /**
   * Applies the action of the user's seat and books the extra stake of a
   * double or a split, and the payouts if the action settles the round. Only
   * the seat whose turn it is can act, the engine checks that.
   *
   * @throws NotSeatedError if the user does not sit at the table.
   * @throws RoundRejectedError if there is no round or the engine rejects the action.
   * @throws InsufficientBalanceError if the balance doesn't cover the extra
   *   stake. Nothing is booked then and the round stays as it was.
   */
  act(
    tableId: string,
    userId: string,
    type: ActionType,
  ): Promise<readonly RoundEvent[]> {
    return this.exclusive(tableId, async (table) => {
      const seat = seatOf(table, userId);
      const { round } = table;

      if (!round) {
        throw new RoundRejectedError(
          'ROUND_FINISHED',
          'No round is in progress',
        );
      }

      const update = unwrap(
        applyAction(round.state, { seat, type }, { rng: this.rng }),
      );
      const extraStake =
        availableActions(round.state)?.actions.find(
          (action) => action.type === type,
        )?.additionalStake ?? 0;

      await this.db.transaction(async (tx) => {
        if (extraStake > 0) {
          await this.ledger.book(
            { userId, delta: -extraStake, reason: 'bet', ref: round.id },
            tx,
          );
        }

        await this.payOut(table, update.round, round.id, tx);
      });

      return store(table, round.id, update);
    });
  }

  /** @throws TableNotOpenError if the table is not open. */
  publicState(tableId: string): PublicTableState {
    const table = this.tableOf(tableId);

    return {
      seats: [...table.seats],
      round: table.round ? publicView(table.round.state) : null,
    };
  }

  private tableOf(tableId: string): PlayTable {
    const table = this.tables.get(tableId);

    if (!table) {
      throw new TableNotOpenError(tableId);
    }

    return table;
  }

  /*
   * Calls on a table run one after another: they await the ledger between
   * reading the round and storing the next one, so two at once would both
   * start from the same round. The queue continues after a failed call, which
   * its own caller still gets to see.
   */
  private async exclusive<T>(
    tableId: string,
    task: (table: PlayTable) => Promise<T> | T,
  ): Promise<T> {
    const table = this.tableOf(tableId);
    const run = table.queue.then(() => {
      // The table may have been closed while the call waited.
      if (this.tables.get(tableId) !== table) {
        throw new TableNotOpenError(tableId);
      }

      return task(table);
    });

    table.queue = run.then(
      () => undefined,
      () => undefined,
    );

    return await run;
  }

  /**
   * Credits what a settled round hands back, one entry per user. Hands that
   * lost get nothing, so a lost stake has no entry.
   */
  private async payOut(
    table: PlayTable,
    round: RoundState,
    roundId: string,
    tx: Transaction,
  ): Promise<void> {
    if (round.phase !== 'settled') {
      return;
    }

    const payouts = new Map<string, number>();

    for (const { seat, payout } of round.results) {
      const userId = table.seats[seat];

      if (!userId) {
        throw new Error(`Seat ${seat} of a settled round has no user`);
      }

      payouts.set(userId, (payouts.get(userId) ?? 0) + payout);
    }

    for (const [userId, delta] of payouts) {
      if (delta > 0) {
        await this.ledger.book(
          { userId, delta, reason: 'payout', ref: roundId },
          tx,
        );
      }
    }
  }
}

function seatOf(table: PlayTable, userId: string): number {
  const seat = table.seats.indexOf(userId);

  if (seat === -1) {
    throw new NotSeatedError(userId);
  }

  return seat;
}

function unwrap(result: Result<RoundUpdate>): RoundUpdate {
  if (!result.ok) {
    throw new RoundRejectedError(result.error.code, result.error.message);
  }

  return result.value;
}

/** Keeps the new round once the bookings are committed. */
function store(
  table: PlayTable,
  roundId: string,
  { round, events }: RoundUpdate,
): readonly RoundEvent[] {
  table.round = { id: roundId, state: round };
  table.shoe = round.shoe;

  return events;
}

function assertSeat(seat: number): void {
  if (!Number.isInteger(seat) || seat < 0 || seat >= SEATS_PER_TABLE) {
    throw new RangeError(
      `seat must be an integer in [0, ${SEATS_PER_TABLE}), got ${seat}`,
    );
  }
}
