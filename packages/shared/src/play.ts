import type { Bet, PublicRoundState, RoundEvent } from '@bustit/engine';
import { z } from 'zod';

/*
 * What a client sends over the live connection while it plays. The server
 * answers each message with an acknowledgement and tells everyone at the
 * table about the change.
 */

/** The names of the messages in both directions. */
export const PLAY_EVENT = {
  join: 'table:join',
  leave: 'table:leave',
  sit: 'table:sit',
  stand: 'table:stand',
  bet: 'round:bet',
  deal: 'round:deal',
  action: 'round:action',
  /** Sent to everyone at a table after every change. */
  state: 'table:state',
  /** Sent to everyone at a table when cards are dealt or played. */
  events: 'round:events',
} as const;

export const tableRequestSchema = z.object({
  tableId: z.uuid(),
});

export type TableRequest = z.infer<typeof tableRequestSchema>;

export const sitRequestSchema = tableRequestSchema.extend({
  seat: z.number().int().min(0),
});

export type SitRequest = z.infer<typeof sitRequestSchema>;

export const betRequestSchema = tableRequestSchema.extend({
  stake: z.number().int().min(1),
});

export type BetRequest = z.infer<typeof betRequestSchema>;

export const actionTypeSchema = z.enum(['hit', 'stand', 'double', 'split']);

export type ActionType = z.infer<typeof actionTypeSchema>;

export const actionRequestSchema = tableRequestSchema.extend({
  type: actionTypeSchema,
});

export type ActionRequest = z.infer<typeof actionRequestSchema>;

/** Why the server did not carry out a message. */
export const playErrorCodeSchema = z.enum([
  'invalid_request',
  'table_not_found',
  'not_joined',
  'seat_invalid',
  'seat_taken',
  'seat_empty',
  'already_seated',
  'seated_elsewhere',
  'not_seated',
  'bet_out_of_limits',
  'insufficient_balance',
  'round_in_progress',
  'betting_closed',
  'action_too_early',
  'round_rejected',
]);

export type PlayErrorCode = z.infer<typeof playErrorCodeSchema>;

/** The table as every client may see it. */
export type PublicTableState = {
  readonly seats: readonly (string | null)[];
  /** The bets placed for the next round, in seat order. */
  readonly bets: readonly Bet[];
  readonly round: PublicRoundState | null;
  /**
   * When the running timer ends, as an ISO timestamp: the result hold of a
   * settled round, the betting window before a round, the turn of the seat to
   * act during one.
   */
  readonly deadline: string | null;
  /**
   * When the seat to act may act, as an ISO timestamp. Actions before it are
   * rejected, so clients can show the pause without guessing it.
   */
  readonly actionableAt: string | null;
};

/** A table's state with the names of the users on its seats. */
export type TableStateMessage = PublicTableState & {
  readonly tableId: string;
  /** The username of every user on a seat, by user id. */
  readonly players: Readonly<Record<string, string>>;
};

export type RoundEventsMessage = {
  readonly tableId: string;
  readonly events: readonly RoundEvent[];
};

/** What the server answers a message with. */
export type PlayAck =
  | { readonly ok: true; readonly state?: TableStateMessage }
  | {
      readonly ok: false;
      readonly error: PlayErrorCode;
      readonly message: string;
    };
