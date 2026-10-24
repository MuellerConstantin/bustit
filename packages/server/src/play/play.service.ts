import {
  type ActionType,
  type Bet,
  DEFAULT_RULES,
  type PublicRoundState,
  type Result,
  type RoundEvent,
  type RoundState,
  type RoundUpdate,
  type Rng,
  type Shoe,
  type TableRules,
  applyAction,
  createShoe,
  publicView,
  startRound,
} from '@bustit/engine';
import { Inject, Injectable } from '@nestjs/common';
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

/** What the server keeps per open table: who sits where, the shoe and the round. */
type PlayTable = {
  readonly rules: TableRules;
  /** The user on each seat, `null` for a free seat. */
  readonly seats: (string | null)[];
  shoe: Shoe;
  round: RoundState | null;
};

/** The table as every client may see it. */
export type PublicTableState = {
  readonly seats: readonly (string | null)[];
  readonly round: PublicRoundState | null;
};

/**
 * Keeps the seats and the current round of every open table in memory. The
 * engine decides the rules, this service only checks who may do what and
 * stores the results.
 */
@Injectable()
export class PlayService {
  private readonly tables = new Map<string, PlayTable>();

  constructor(@Inject(ROUND_RNG) private readonly rng: Rng) {}

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
    });
  }

  /** @throws RoundInProgressError while a round is being played. */
  closeTable(tableId: string): void {
    const table = this.tableOf(tableId);

    if (table.round?.phase === 'playerTurns') {
      throw new RoundInProgressError(tableId);
    }

    this.tables.delete(tableId);
  }

  /**
   * @throws TableNotOpenError if the table is not open.
   * @throws AlreadySeatedError if the user already sits at the table.
   * @throws SeatTakenError if another user sits on the seat.
   */
  sit(tableId: string, seat: number, userId: string): void {
    const table = this.tableOf(tableId);
    assertSeat(seat);

    if (table.seats.includes(userId)) {
      throw new AlreadySeatedError(userId);
    }

    if (table.seats[seat]) {
      throw new SeatTakenError(seat);
    }

    table.seats[seat] = userId;
  }

  /**
   * @throws NotSeatedError if the user does not sit at the table.
   * @throws RoundInProgressError while the user's seat is still in a round.
   */
  leave(tableId: string, userId: string): void {
    const table = this.tableOf(tableId);
    const seat = this.seatOf(table, userId);

    if (table.round?.phase === 'playerTurns') {
      throw new RoundInProgressError(tableId);
    }

    table.seats[seat] = null;
  }

  /**
   * Deals a round to the seats with a bet. Every seat must be taken, and the
   * previous round must be settled.
   *
   * @throws SeatEmptyError if a bet is placed on a free seat.
   * @throws RoundInProgressError while a round is being played.
   * @throws RoundRejectedError if the engine rejects the bets.
   */
  startRound(tableId: string, bets: readonly Bet[]): readonly RoundEvent[] {
    const table = this.tableOf(tableId);

    if (table.round?.phase === 'playerTurns') {
      throw new RoundInProgressError(tableId);
    }

    for (const { seat } of bets) {
      if (!table.seats[seat]) {
        throw new SeatEmptyError(seat);
      }
    }

    return this.store(
      table,
      startRound(
        { rules: table.rules, shoe: table.shoe, bets },
        { rng: this.rng },
      ),
    );
  }

  /**
   * Applies the action of the user's seat. Only the seat whose turn it is
   * can act, the engine checks that.
   *
   * @throws NotSeatedError if the user does not sit at the table.
   * @throws RoundRejectedError if there is no round or the engine rejects the action.
   */
  act(tableId: string, userId: string, type: ActionType): readonly RoundEvent[] {
    const table = this.tableOf(tableId);
    const seat = this.seatOf(table, userId);

    if (!table.round) {
      throw new RoundRejectedError('ROUND_FINISHED', 'No round is in progress');
    }

    return this.store(
      table,
      applyAction(table.round, { seat, type }, { rng: this.rng }),
    );
  }

  /** @throws TableNotOpenError if the table is not open. */
  publicState(tableId: string): PublicTableState {
    const table = this.tableOf(tableId);

    return {
      seats: [...table.seats],
      round: table.round ? publicView(table.round) : null,
    };
  }

  private tableOf(tableId: string): PlayTable {
    const table = this.tables.get(tableId);

    if (!table) {
      throw new TableNotOpenError(tableId);
    }

    return table;
  }

  private seatOf(table: PlayTable, userId: string): number {
    const seat = table.seats.indexOf(userId);

    if (seat === -1) {
      throw new NotSeatedError(userId);
    }

    return seat;
  }

  /** Keeps the new round only if the engine accepted the call. */
  private store(
    table: PlayTable,
    result: Result<RoundUpdate>,
  ): readonly RoundEvent[] {
    if (!result.ok) {
      throw new RoundRejectedError(result.error.code, result.error.message);
    }

    table.round = result.value.round;
    table.shoe = result.value.round.shoe;

    return result.value.events;
  }
}

function assertSeat(seat: number): void {
  if (!Number.isInteger(seat) || seat < 0 || seat >= SEATS_PER_TABLE) {
    throw new RangeError(
      `seat must be an integer in [0, ${SEATS_PER_TABLE}), got ${seat}`,
    );
  }
}
