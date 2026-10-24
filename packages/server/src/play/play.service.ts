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
import { InsufficientBalanceError, LedgerService } from '../ledger/index.js';
import { TablesService } from '../tables/index.js';
import {
  AlreadySeatedError,
  BetOutOfLimitsError,
  InvalidSeatError,
  NotSeatedError,
  RoundInProgressError,
  RoundRejectedError,
  SeatEmptyError,
  SeatTakenError,
  TableAlreadyOpenError,
  TableNotOpenError,
} from './play.errors.js';

/** Injection token of the generator that shuffles the shoes and deals. */
export const ROUND_RNG = Symbol('ROUND_RNG');

/** What an open table is set up with. */
export type TableConfig = {
  readonly seats: number;
  /** Lowest and highest stake of a bet, in whole Bucks. */
  readonly minBet: number;
  readonly maxBet: number;
  readonly rules?: TableRules;
};

/** A round with the id its ledger entries refer to. */
type ActiveRound = {
  readonly id: string;
  readonly state: RoundState;
};

/** What the server keeps per open table: who sits where, the shoe and the round. */
type PlayTable = {
  readonly rules: TableRules;
  readonly minBet: number;
  readonly maxBet: number;
  /** The user on each seat, `null` for a free seat. */
  readonly seats: (string | null)[];
  /** The stake each seat has placed for the next round. */
  readonly bets: Map<number, number>;
  shoe: Shoe;
  round: ActiveRound | null;
  /** The calls waiting for their turn, see `exclusive`. */
  queue: Promise<unknown>;
};

/** The table as every client may see it. */
export type PublicTableState = {
  readonly seats: readonly (string | null)[];
  /** The bets placed for the next round, in seat order. */
  readonly bets: readonly Bet[];
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
    private readonly tablesService: TablesService,
  ) {}

  /** @throws TableAlreadyOpenError if the table is open already. */
  openTable(
    tableId: string,
    { seats, minBet, maxBet, rules = DEFAULT_RULES }: TableConfig,
  ): void {
    if (this.tables.has(tableId)) {
      throw new TableAlreadyOpenError(tableId);
    }

    this.tables.set(tableId, {
      rules,
      minBet,
      maxBet,
      seats: Array.from({ length: seats }, () => null),
      bets: new Map(),
      shoe: createShoe(rules, this.rng),
      round: null,
      queue: Promise.resolve(),
    });
  }

  /**
   * Opens the table in memory with the seats and bet limits it was created
   * with, unless it is open already.
   *
   * @throws TableNotOpenError if there is no open table with the id.
   */
  async ensureOpen(tableId: string): Promise<void> {
    const table = await this.tablesService.findOpen(tableId);

    if (!table) {
      throw new TableNotOpenError(tableId);
    }

    // Nothing is awaited from here on, so no other call can open it first.
    if (!this.tables.has(tableId)) {
      this.openTable(tableId, table);
    }
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
      if (!Number.isInteger(seat) || seat < 0 || seat >= table.seats.length) {
        throw new InvalidSeatError(seat, table.seats.length);
      }

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
   * Frees the user's seat together with the bet placed from it.
   *
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
      table.bets.delete(seat);
    });
  }

  /**
   * Places the stake of the user's seat for the next round, replacing an
   * earlier one. Nothing is booked before the round is dealt.
   *
   * @throws NotSeatedError if the user does not sit at the table.
   * @throws RoundInProgressError while a round is being played.
   * @throws BetOutOfLimitsError if the stake is outside the table's limits.
   */
  placeBet(tableId: string, userId: string, stake: number): Promise<void> {
    return this.exclusive(tableId, (table) => {
      const seat = seatOf(table, userId);

      if (table.round?.state.phase === 'playerTurns') {
        throw new RoundInProgressError(tableId);
      }

      assertWithinLimits(table, stake);
      table.bets.set(seat, stake);
    });
  }

  /**
   * Deals a round to the seats with a bet and books the stakes, and the
   * payouts if the round is settled right away. The previous round must be
   * settled.
   *
   * @throws SeatEmptyError if a bet is placed on a free seat.
   * @throws RoundInProgressError while a round is being played.
   * @throws BetOutOfLimitsError if a stake is outside the table's limits.
   * @throws RoundRejectedError if the engine rejects the bets.
   * @throws InsufficientBalanceError if a balance doesn't cover its stake.
   *   Nothing is booked then and the table stays as it was.
   */
  startRound(
    tableId: string,
    bets: readonly Bet[],
  ): Promise<readonly RoundEvent[]> {
    return this.exclusive(tableId, (table) =>
      this.start(tableId, table, bets),
    );
  }

  /**
   * Deals a round to the bets placed with `placeBet`, on the request of a
   * user at the table. A bet the balance doesn't cover is dropped, so the
   * others can be dealt again.
   *
   * @throws NotSeatedError if the user does not sit at the table.
   * @throws RoundInProgressError while a round is being played.
   * @throws RoundRejectedError if no bet is placed.
   * @throws InsufficientBalanceError if a balance doesn't cover its stake.
   */
  dealRound(tableId: string, userId: string): Promise<readonly RoundEvent[]> {
    return this.exclusive(tableId, async (table) => {
      seatOf(table, userId);

      const bets = [...table.bets].map(([seat, stake]) => ({ seat, stake }));

      try {
        return await this.start(tableId, table, bets);
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          table.bets.delete(table.seats.indexOf(error.userId));
        }

        throw error;
      }
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
      bets: [...table.bets]
        .map(([seat, stake]) => ({ seat, stake }))
        .sort((a, b) => a.seat - b.seat),
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

  private async start(
    tableId: string,
    table: PlayTable,
    bets: readonly Bet[],
  ): Promise<readonly RoundEvent[]> {
    if (table.round?.state.phase === 'playerTurns') {
      throw new RoundInProgressError(tableId);
    }

    for (const { seat, stake } of bets) {
      if (!table.seats[seat]) {
        throw new SeatEmptyError(seat);
      }

      assertWithinLimits(table, stake);
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

    table.bets.clear();

    return store(table, roundId, update);
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

function assertWithinLimits(
  { minBet, maxBet }: PlayTable,
  stake: number,
): void {
  if (!Number.isInteger(stake) || stake < minBet || stake > maxBet) {
    throw new BetOutOfLimitsError(stake, minBet, maxBet);
  }
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
