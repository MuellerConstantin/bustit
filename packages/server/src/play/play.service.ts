import {
  type ActionType,
  type Bet,
  DEFAULT_RULES,
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
import type { PublicTableState } from '@bustit/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, sql } from 'drizzle-orm';
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
import { rounds } from './play.schema.js';

/** Injection token of the generator that shuffles the shoes and deals. */
export const ROUND_RNG = Symbol('ROUND_RNG');

/** Injection token of the `PlayTimings`. */
export const PLAY_TIMINGS = Symbol('PLAY_TIMINGS');

export type PlayTimings = {
  /** How long bets can be placed after the first one before the round is dealt. */
  readonly betWindowMs: number;
  /** How long a seat has to act before it is sent a stand. */
  readonly turnMs: number;
};

export const DEFAULT_PLAY_TIMINGS: PlayTimings = {
  betWindowMs: 15_000,
  turnMs: 20_000,
};

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

/** The one timer a table has running: the betting window or a seat's turn. */
type ArmedTimer = {
  readonly kind: 'bet' | 'turn';
  readonly endsAt: number;
  readonly handle: NodeJS.Timeout;
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
  /** Users whose connection is gone but whose hands are still in the round. */
  readonly absent: Set<string>;
  shoe: Shoe;
  round: ActiveRound | null;
  timer: ArmedTimer | null;
  /** The calls waiting for their turn, see `exclusive`. */
  queue: Promise<unknown>;
};

/** A table changed, by a call or by one of its timers. */
export type TableChange = {
  readonly tableId: string;
  /** What happened in the round, if cards were dealt or played. */
  readonly events?: readonly RoundEvent[];
};

export type TableChangeListener = (change: TableChange) => void;

/**
 * Keeps the seats and the current round of every open table in memory. The
 * engine decides the rules, this service checks who may do what, books the
 * stakes and payouts on the ledger, stores the results and lets the timers
 * of the table deal and stand when nobody acts. Everyone interested in the
 * changes listens with `onChange`.
 */
@Injectable()
export class PlayService implements OnModuleDestroy {
  private readonly logger = new Logger(PlayService.name);
  private readonly tables = new Map<string, PlayTable>();
  private readonly listeners = new Set<TableChangeListener>();

  constructor(
    @Inject(ROUND_RNG) private readonly rng: Rng,
    @InjectDrizzle() private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly tablesService: TablesService,
    @Inject(PLAY_TIMINGS) private readonly timings: PlayTimings,
  ) {}

  onModuleDestroy(): void {
    for (const table of this.tables.values()) {
      clearTimer(table);
    }
  }

  /** Returns a function that stops listening. */
  onChange(listener: TableChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

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
      absent: new Set(),
      shoe: createShoe(rules, this.rng),
      round: null,
      timer: null,
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

      clearTimer(table);
      this.tables.delete(tableId);
    });
  }

  /** The ids of the open tables the user sits at. */
  tablesOf(userId: string): string[] {
    return [...this.tables]
      .filter(([, table]) => table.seats.includes(userId))
      .map(([tableId]) => tableId);
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
      this.emit(tableId);
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

      this.free(tableId, table, seat);
    });
  }

  /**
   * The user's connection is gone. Between rounds the seat is freed. During
   * a round the hands are played on, with a stand as soon as one is to act,
   * and the seat is freed once the round is settled.
   */
  absent(tableId: string, userId: string): Promise<void> {
    return this.exclusive(tableId, (table) => {
      const seat = table.seats.indexOf(userId);

      if (seat === -1) {
        return;
      }

      const round = table.round?.state;

      if (round?.phase !== 'playerTurns') {
        this.free(tableId, table, seat);
        return;
      }

      table.absent.add(userId);

      if (round.turn?.seat === seat) {
        this.armTurn(tableId, table);
      }

      this.emit(tableId);
    });
  }

  /** The user is back, so their seat is kept after the round. */
  present(tableId: string, userId: string): Promise<void> {
    return this.exclusive(tableId, (table) => {
      table.absent.delete(userId);
    });
  }

  /**
   * Places the stake of the user's seat for the next round, replacing an
   * earlier one. Nothing is booked before the round is dealt. The first bet
   * opens the betting window, after which the round is dealt on its own.
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
      this.armBet(tableId, table);
      this.emit(tableId);
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
    return this.exclusive(tableId, async (table) => {
      const events = await this.start(tableId, table, bets);
      this.emit(tableId, events);

      return events;
    });
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

      try {
        const events = await this.start(tableId, table, betsOf(table));
        this.emit(tableId, events);

        return events;
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          this.dropBet(tableId, table, error.userId);
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
      const events = await this.apply(
        tableId,
        table,
        seatOf(table, userId),
        type,
      );
      this.emit(tableId, events);

      return events;
    });
  }

  /** @throws TableNotOpenError if the table is not open. */
  publicState(tableId: string): PublicTableState {
    const table = this.tableOf(tableId);

    return {
      seats: [...table.seats],
      bets: betsOf(table),
      round: table.round ? publicView(table.round.state) : null,
      deadline: table.timer ? new Date(table.timer.endsAt).toISOString() : null,
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

  private emit(tableId: string, events?: readonly RoundEvent[]): void {
    const change: TableChange = events ? { tableId, events } : { tableId };

    for (const listener of this.listeners) {
      listener(change);
    }
  }

  private free(tableId: string, table: PlayTable, seat: number): void {
    table.seats[seat] = null;
    table.bets.delete(seat);
    this.armBet(tableId, table);
    this.emit(tableId);
  }

  private dropBet(tableId: string, table: PlayTable, userId: string): void {
    table.bets.delete(table.seats.indexOf(userId));
    this.armBet(tableId, table);
    this.emit(tableId);
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

    const roundId = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(rounds)
        .values({ tableId })
        .returning({ id: rounds.id });
      const { id } = created!;

      for (const { seat, stake } of bets) {
        await this.ledger.book(
          {
            userId: table.seats[seat]!,
            delta: -stake,
            reason: 'bet',
            ref: id,
          },
          tx,
        );
      }

      await this.settle(table, update.round, id, tx);

      return id;
    });

    table.bets.clear();

    return this.store(tableId, table, roundId, update);
  }

  private async apply(
    tableId: string,
    table: PlayTable,
    seat: number,
    type: ActionType,
  ): Promise<readonly RoundEvent[]> {
    const { round } = table;

    if (!round) {
      throw new RoundRejectedError('ROUND_FINISHED', 'No round is in progress');
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
          {
            userId: table.seats[seat]!,
            delta: -extraStake,
            reason: 'bet',
            ref: round.id,
          },
          tx,
        );
      }

      await this.settle(table, update.round, round.id, tx);
    });

    return this.store(tableId, table, round.id, update);
  }

  /**
   * Keeps the new round once the bookings are committed, frees the seats of
   * users who left in the meantime once it is settled and sets the timer for
   * what comes next.
   */
  private store(
    tableId: string,
    table: PlayTable,
    roundId: string,
    { round, events }: RoundUpdate,
  ): readonly RoundEvent[] {
    table.round = { id: roundId, state: round };
    table.shoe = round.shoe;

    if (round.phase === 'settled') {
      for (const userId of table.absent) {
        const seat = table.seats.indexOf(userId);

        if (seat !== -1) {
          table.seats[seat] = null;
          table.bets.delete(seat);
        }
      }

      table.absent.clear();
    }

    this.armTurn(tableId, table);

    return events;
  }

  /**
   * Does nothing for a round that goes on. For a settled one it credits what
   * the round hands back, one entry per user, and ends the round's record.
   * Hands that lost get nothing, so a lost stake has no entry.
   */
  private async settle(
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

    await tx
      .update(rounds)
      .set({ status: 'settled', endedAt: sql`now()` })
      .where(eq(rounds.id, roundId));
  }

  /**
   * Gives the seat to act its time, or none if its user is gone, and stops
   * the timer when there is nobody to wait for.
   */
  private armTurn(tableId: string, table: PlayTable): void {
    const round = table.round?.state;

    if (round?.phase !== 'playerTurns' || !round.turn) {
      clearTimer(table);
      return;
    }

    const userId = table.seats[round.turn.seat];

    this.arm(
      tableId,
      table,
      'turn',
      userId && table.absent.has(userId) ? 0 : this.timings.turnMs,
    );
  }

  /**
   * Opens the betting window with the first bet and closes it when the bets
   * are gone. Later bets don't extend a window that is running.
   */
  private armBet(tableId: string, table: PlayTable): void {
    if (table.round?.state.phase === 'playerTurns') {
      return;
    }

    if (table.bets.size === 0) {
      clearTimer(table);
      return;
    }

    if (table.timer?.kind !== 'bet') {
      this.arm(tableId, table, 'bet', this.timings.betWindowMs);
    }
  }

  private arm(
    tableId: string,
    table: PlayTable,
    kind: ArmedTimer['kind'],
    delayMs: number,
  ): void {
    clearTimer(table);

    const timer: ArmedTimer = {
      kind,
      endsAt: Date.now() + delayMs,
      handle: setTimeout(() => this.fire(tableId, timer), delayMs),
    };

    // A timer alone doesn't keep the process alive.
    timer.handle.unref();
    table.timer = timer;
  }

  /*
   * Runs like any other call on the table. By then the timer may have been
   * replaced, e.g. because someone acted just in time, which makes it void.
   */
  private fire(tableId: string, timer: ArmedTimer): void {
    this.exclusive(tableId, async (table) => {
      if (table.timer !== timer) {
        return;
      }

      table.timer = null;

      if (timer.kind === 'turn') {
        await this.standForTurn(tableId, table);
      } else {
        await this.dealPlacedBets(tableId, table);
      }
    }).catch((error: unknown) => {
      this.logger.error(
        `The ${timer.kind} timer of table ${tableId} failed`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  /** Sends the seat that ran out of time a stand. */
  private async standForTurn(tableId: string, table: PlayTable): Promise<void> {
    const turn = table.round?.state.turn;

    if (!turn) {
      return;
    }

    this.emit(tableId, await this.apply(tableId, table, turn.seat, 'stand'));
  }

  /** Deals the placed bets, leaving out the ones the balance doesn't cover. */
  private async dealPlacedBets(
    tableId: string,
    table: PlayTable,
  ): Promise<void> {
    while (table.bets.size > 0) {
      try {
        this.emit(tableId, await this.start(tableId, table, betsOf(table)));
        return;
      } catch (error) {
        if (!(error instanceof InsufficientBalanceError)) {
          throw error;
        }

        this.dropBet(tableId, table, error.userId);
      }
    }
  }
}

function clearTimer(table: PlayTable): void {
  if (table.timer) {
    clearTimeout(table.timer.handle);
    table.timer = null;
  }
}

function betsOf(table: PlayTable): Bet[] {
  return [...table.bets]
    .map(([seat, stake]) => ({ seat, stake }))
    .sort((a, b) => a.seat - b.seat);
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
