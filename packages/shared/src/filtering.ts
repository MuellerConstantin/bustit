import { z } from 'zod';

export const MAX_FILTER_LENGTH = 500;

/**
 * Narrows a list with an RSQL expression, e.g. `status=in=(open,used)`.
 * Which fields and operators a list accepts is up to the list.
 */
export const filterQuerySchema = z.object({
  filter: z.string().trim().min(1).max(MAX_FILTER_LENGTH).optional(),
});

export type FilterQuery = z.infer<typeof filterQuerySchema>;
