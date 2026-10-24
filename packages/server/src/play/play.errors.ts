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

export class NotSeatedError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} does not sit at this table`);
    this.name = 'NotSeatedError';
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
