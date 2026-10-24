import { z } from 'zod';

/*
 * What a client sends over the live connection while it plays. The server
 * answers each message with an acknowledgement and tells everyone at the
 * table about the change.
 */

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
  'not_seated',
  'bet_out_of_limits',
  'insufficient_balance',
  'round_in_progress',
  'round_rejected',
]);

export type PlayErrorCode = z.infer<typeof playErrorCodeSchema>;
