import {
  PLAY_EVENT,
  type PlayAck,
  type PlayErrorCode,
  REALTIME_PATH,
  type RoundEventsMessage,
  type TableRequest,
  type TableStateMessage,
  actionRequestSchema,
  betRequestSchema,
  sitRequestSchema,
  tableRequestSchema,
} from '@bustit/shared';
import {
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayDisconnect,
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
  SeatedElsewhereError,
  SeatEmptyError,
  SeatTakenError,
  TableNotOpenError,
} from './play.errors.js';
import { PlayService, type TableChange } from './play.service.js';

const roomOf = (tableId: string) => `table:${tableId}`;

/**
 * The messages a connected user plays with. Joining a table subscribes the
 * connection to the table's room, whose members get every change as the
 * public state, so nothing secret leaves the server. The changes come from
 * the `PlayService`, whether a message or a timer caused them. The
 * connection check lives in the `RealtimeAdapter`, so handlers only see
 * logged-in users.
 */
@WebSocketGateway({ path: REALTIME_PATH })
export class PlayGateway
  implements OnModuleInit, OnModuleDestroy, OnGatewayDisconnect
{
  private readonly logger = new Logger(PlayGateway.name);
  private stopListening: (() => void) | null = null;

  /*
   * The names of the users who sent a message, for the state to show on
   * their seats. A user can only sit down after a message, so every seat has
   * a name.
   */
  private readonly usernames = new Map<string, string>();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly play: PlayService) {}

  onModuleInit(): void {
    this.stopListening = this.play.onChange((change) => {
      this.publish(change);
    });
  }

  onModuleDestroy(): void {
    this.stopListening?.();
  }

  /**
   * Seats of a user whose last connection to a table is gone are given up,
   * see `PlayService.absent`. Another tab of the same user keeps them.
   */
  async handleDisconnect(socket: Socket): Promise<void> {
    const { user } = socket.data as RealtimeSocketData;

    try {
      for (const tableId of this.play.tablesOf(user.id)) {
        const members = await this.server.in(roomOf(tableId)).fetchSockets();

        if (!members.some((member) => connectedAs(member.data, user.id))) {
          await this.play.absent(tableId, user.id);
        }
      }
    } catch (error) {
      this.logger.error(
        `Giving up the seats of user ${user.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Opens the table if needed, joins its room and answers its state. */
  @SubscribeMessage(PLAY_EVENT.join)
  join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      tableRequestSchema,
      async ({ tableId }, user) => {
        await this.play.ensureOpen(tableId);
        await socket.join(roomOf(tableId));
        await this.play.present(tableId, user.id);

        return this.stateOf(tableId);
      },
      false,
    );
  }

  /**
   * Frees the user's seat, if any, and leaves the table's room. A seat in
   * the middle of a round is freed when the round is settled, its hands are
   * played with a stand.
   */
  @SubscribeMessage(PLAY_EVENT.leave)
  leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      tableRequestSchema,
      async ({ tableId }, user) => {
        await this.play.absent(tableId, user.id);
        await socket.leave(roomOf(tableId));
      },
    );
  }

  @SubscribeMessage(PLAY_EVENT.sit)
  sit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      sitRequestSchema,
      async ({ tableId, seat }, user) => {
        await this.play.sit(tableId, seat, user.id);
      },
    );
  }

  /** Frees the user's seat but stays at the table as a spectator. */
  @SubscribeMessage(PLAY_EVENT.stand)
  stand(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      tableRequestSchema,
      async ({ tableId }, user) => {
        await this.play.leave(tableId, user.id);
      },
    );
  }

  /** Places the stake for the next round. */
  @SubscribeMessage(PLAY_EVENT.bet)
  bet(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      betRequestSchema,
      async ({ tableId, stake }, user) => {
        await this.play.placeBet(tableId, user.id, stake);
      },
    );
  }

  /** Deals the next round to the seats that placed a bet. */
  @SubscribeMessage(PLAY_EVENT.deal)
  deal(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      tableRequestSchema,
      async ({ tableId }, user) => {
        await this.play.dealRound(tableId, user.id);
      },
    );
  }

  @SubscribeMessage(PLAY_EVENT.action)
  act(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<PlayAck> {
    return this.handle(
      socket,
      body,
      actionRequestSchema,
      async ({ tableId, type }, user) => {
        await this.play.act(tableId, user.id, type);
      },
    );
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
    ) => Promise<TableStateMessage | void>,
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

    this.usernames.set(user.id, user.username);

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

  private publish({ tableId, events }: TableChange): void {
    const room = this.server.to(roomOf(tableId));

    if (events) {
      room.emit(PLAY_EVENT.events, {
        tableId,
        events,
      } satisfies RoundEventsMessage);
    }

    room.emit(PLAY_EVENT.state, this.stateOf(tableId));
  }

  /** The table's public state with the names of the users on its seats. */
  private stateOf(tableId: string): TableStateMessage {
    const state = this.play.publicState(tableId);
    const players: Record<string, string> = {};

    for (const userId of state.seats) {
      if (userId) {
        players[userId] = this.usernames.get(userId) ?? userId;
      }
    }

    return { tableId, ...state, players };
  }
}

/** Whether the data a connection carries belongs to the user. */
function connectedAs(data: unknown, userId: string): boolean {
  return (data as RealtimeSocketData).user.id === userId;
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
  [SeatedElsewhereError, 'seated_elsewhere'],
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
