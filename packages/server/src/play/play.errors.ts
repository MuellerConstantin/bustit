import type { EngineErrorCode } from '@bustit/engine';

export class TableNotOpenError extends Error {
  constructor(readonly tableId: string) {
    super(`Table ${tableId} is not open`);
    this.name = 'TableNotOpenError';
  }
}

export class TableAlreadyOpenError extends Error {
  constructor(readonly tableId: string) {
    super(`Table ${tableId} is already open`);
    this.name = 'TableAlreadyOpenError';
  }
}

export class NotJoinedError extends Error {
  constructor(readonly tableId: string) {
    super(`The connection has not joined table ${tableId}`);
    this.name = 'NotJoinedError';
  }
}

export class InvalidSeatError extends Error {
  constructor(
    readonly seat: number,
    readonly seats: number,
  ) {
    super(`Seat ${seat} does not exist, the table has ${seats} seats`);
    this.name = 'InvalidSeatError';
  }
}

export class SeatTakenError extends Error {
  constructor(readonly seat: number) {
    super(`Seat ${seat} is taken`);
    this.name = 'SeatTakenError';
  }
}

export class SeatEmptyError extends Error {
  constructor(readonly seat: number) {
    super(`Seat ${seat} is empty`);
    this.name = 'SeatEmptyError';
  }
}

export class AlreadySeatedError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} already sits at this table`);
    this.name = 'AlreadySeatedError';
  }
}

export class SeatedElsewhereError extends Error {
  constructor(
    readonly userId: string,
    readonly tableId: string,
  ) {
    super(`User ${userId} already sits at table ${tableId}`);
    this.name = 'SeatedElsewhereError';
  }
}

export class NotSeatedError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} does not sit at this table`);
    this.name = 'NotSeatedError';
  }
}

export class BetOutOfLimitsError extends Error {
  constructor(
    readonly stake: number,
    readonly minBet: number,
    readonly maxBet: number,
  ) {
    super(`A bet of ${stake} is outside the limits ${minBet} to ${maxBet}`);
    this.name = 'BetOutOfLimitsError';
  }
}

export class RoundInProgressError extends Error {
  constructor(readonly tableId: string) {
    super(`A round is in progress at table ${tableId}`);
    this.name = 'RoundInProgressError';
  }
}

/** The engine rejected a bet or an action; `code` is the engine's error code. */
export class RoundRejectedError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoundRejectedError';
  }
}
