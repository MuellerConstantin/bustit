import { z } from 'zod';
import { filterQuerySchema } from './filtering.js';
import { pageQuerySchema, pageSchema } from './pagination.js';

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

/** An open table as players see it in the lobby. */
export const tableSchema = z.object({
  id: z.string(),
  name: z.string(),
  seats: z.number().int(),
  minBet: z.number().int(),
  maxBet: z.number().int(),
});

export type Table = z.infer<typeof tableSchema>;

export const tablePageSchema = pageSchema(tableSchema);

export type TablePage = z.infer<typeof tablePageSchema>;

/** A table as the operations console shows it, closed ones included. */
export const bocTableSchema = tableSchema.extend({
  status: tableStatusSchema,
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});

export type BocTable = z.infer<typeof bocTableSchema>;

export const bocTablePageSchema = pageSchema(bocTableSchema);

export type BocTablePage = z.infer<typeof bocTablePageSchema>;

/** Lists tables page by page, optionally narrowed by a filter. */
export const listTablesQuerySchema = pageQuerySchema.extend(
  filterQuerySchema.shape,
);

export type ListTablesQuery = z.infer<typeof listTablesQuerySchema>;
