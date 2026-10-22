import { z } from 'zod';
import { filterQuerySchema } from './filtering.js';
import { pageQuerySchema } from './pagination.js';

export const tableStatusSchema = z.enum(['open', 'closed']);

export type TableStatus = z.infer<typeof tableStatusSchema>;

export const TABLE_NAME_MAX_LENGTH = 50;

export const tableNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(TABLE_NAME_MAX_LENGTH);

export const TABLE_MIN_SEATS = 1;
export const TABLE_MAX_SEATS = 7;

export const tableSeatsSchema = z
  .number()
  .int()
  .min(TABLE_MIN_SEATS)
  .max(TABLE_MAX_SEATS);

/** A bet limit in whole Bucks. */
export const tableBetLimitSchema = z.number().int().min(1);

export const createTableRequestSchema = z
  .object({
    name: tableNameSchema,
    seats: tableSeatsSchema,
    minBet: tableBetLimitSchema,
    maxBet: tableBetLimitSchema,
  })
  .refine(({ minBet, maxBet }) => minBet <= maxBet, {
    message: 'The maximum bet must not be below the minimum bet',
    path: ['maxBet'],
  });

export type CreateTableRequest = z.infer<typeof createTableRequestSchema>;

/** Lists tables page by page, optionally narrowed by a filter. */
export const listTablesQuerySchema = pageQuerySchema.extend(
  filterQuerySchema.shape,
);

export type ListTablesQuery = z.infer<typeof listTablesQuerySchema>;
