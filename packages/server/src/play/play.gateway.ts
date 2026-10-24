import {
  type PlayErrorCode,
  REALTIME_PATH,
  type TableRequest,
  actionRequestSchema,
  betRequestSchema,
  sitRequestSchema,
  tableRequestSchema,
} from '@bustit/shared';
import type { RoundEvent } from '@bustit/engine';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { AuthenticatedUser } from '../auth/index.js';
import type { RealtimeSocketData } from '../infrastructure/realtime/index.js';
import { InsufficientBalanceError } from '../ledger/index.js';
import {
  AlreadySeatedError,
  BetOutOfLimitsError,
  InvalidSeatError,
  NotJoinedError,
  NotSeatedError,
  RoundInProgressError,
  RoundRejectedError,
  SeatEmptyError,
  SeatTakenError,
  TableNotOpenError,
} from './play.errors.js';
import { PlayService, type PublicTableState } from './play.service.js';

/** What a message is answered with. */
export type PlayAck =
  | { readonly ok: true; readonly state?: PublicTableState }
  | {
      readonly ok: false;
      readonly error: PlayErrorCode;
      readonly message: string;
    };

/** Sent to everyone at a table after every change. */
export type TableStateMessage = PublicTableState & { readonly tableId: string };

/** Sent to everyone at a table when cards are dealt or played. */
export type RoundEventsMessage = {
  readonly tableId: string;
  readonly events: readonly RoundEvent[];
};

const roomOf = (tableId: string) => `table:${tableId}`;

/**
 * The messages a connected user plays with. Joining a table subscribes the
 * connection to the table's room, whose members get every change as the
 * public state, so nothing secret leaves the server. The connection check
 * lives in the `RealtimeAdapter`, so handlers only see logged-in users.
 */
@WebSocketGateway({ path: REALTIME_PATH })
export class PlayGateway {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly play: PlayService) {}

  /** Opens the table if needed, joins its room and answers its state. */
  @SubscribeMessage('table:join')
  join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      tableRequestSchema,
      async ({ tableId }) => {
        await this.play.ensureOpen(tableId);
        await socket.join(roomOf(tableId));

        return this.play.publicState(tableId);
      },
      false,
    );
  }

  /** Frees the user's seat, if any, and leaves the table's room. */
  @SubscribeMessage('table:leave')
  leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(socket, body, tableRequestSchema, async (request, user) => {
      try {
        await this.play.leave(request.tableId, user.id);
      } catch (error) {
        if (!(error instanceof NotSeatedError)) {
          throw error;
        }
      }

      await socket.leave(roomOf(request.tableId));
      this.publish(request.tableId);
    });
  }

  @SubscribeMessage('table:sit')
  sit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(socket, body, sitRequestSchema, async (request, user) => {
      await this.play.sit(request.tableId, request.seat, user.id);
      this.publish(request.tableId);
    });
  }

  /** Frees the user's seat but stays at the table as a spectator. */
  @SubscribeMessage('table:stand')
  stand(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(socket, body, tableRequestSchema, async (request, user) => {
      await this.play.leave(request.tableId, user.id);
      this.publish(request.tableId);
    });
  }

  /** Places the stake for the next round. */
  @SubscribeMessage('round:bet')
  bet(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(socket, body, betRequestSchema, async (request, user) => {
      await this.play.placeBet(request.tableId, user.id, request.stake);
      this.publish(request.tableId);
    });
  }

  /** Deals the next round to the seats that placed a bet. */
  @SubscribeMessage('round:deal')
  deal(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(socket, body, tableRequestSchema, async (request, user) => {
      const events = await this.play.dealRound(request.tableId, user.id);
      this.publish(request.tableId, events);
    });
  }

  @SubscribeMessage('round:action')
  act(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(socket, body, actionRequestSchema, async (request, user) => {
      const events = await this.play.act(
        request.tableId,
        user.id,
        request.type,
      );
      this.publish(request.tableId, events);
    });
  }

  /**
   * Validates the message, checks that the connection has joined the table
   * unless it is about to, runs the task and turns expected failures into
   * the acknowledgement. Anything else is a bug and propagates.
   */
  private async handle<S extends z.ZodType<TableRequest>>(
    socket: Socket,
    body: unknown,
    schema: S,
    task: (
      request: z.output<S>,
      user: AuthenticatedUser,
    ) => Promise<PublicTableState | void>,
    requireJoin = true,
  ): Promise<PlayAck> {
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return {
        ok: false,
        error: 'invalid_request',
        message: 'Invalid request',
      };
    }

    const request: z.output<S> = parsed.data;
    const { user } = socket.data as RealtimeSocketData;

    try {
      if (requireJoin && !socket.rooms.has(roomOf(request.tableId))) {
        throw new NotJoinedError(request.tableId);
      }

      const state = await task(request, user);

      return state ? { ok: true, state } : { ok: true };
    } catch (error) {
      const failure = failureOf(error);

      if (!failure) {
        throw error;
      }

      return failure;
    }
  }

  private publish(tableId: string, events?: readonly RoundEvent[]): void {
    const room = this.server.to(roomOf(tableId));

    if (events) {
      room.emit('round:events', { tableId, events } satisfies RoundEventsMessage);
    }

    room.emit('table:state', {
      tableId,
      ...this.play.publicState(tableId),
    } satisfies TableStateMessage);
  }
}

/** The expected failures and the code each one is answered with. */
const failureCodes: readonly (readonly [
  abstract new (...args: never[]) => Error,
  PlayErrorCode,
])[] = [
  [TableNotOpenError, 'table_not_found'],
  [NotJoinedError, 'not_joined'],
  [InvalidSeatError, 'seat_invalid'],
  [SeatTakenError, 'seat_taken'],
  [SeatEmptyError, 'seat_empty'],
  [AlreadySeatedError, 'already_seated'],
  [NotSeatedError, 'not_seated'],
  [BetOutOfLimitsError, 'bet_out_of_limits'],
  [InsufficientBalanceError, 'insufficient_balance'],
  [RoundInProgressError, 'round_in_progress'],
  [RoundRejectedError, 'round_rejected'],
];

/** The acknowledgement for an expected failure, `null` for anything else. */
function failureOf(error: unknown): PlayAck | null {
  const match = failureCodes.find(([type]) => error instanceof type);

  return match && error instanceof Error
    ? { ok: false, error: match[1], message: error.message }
    : null;
}
