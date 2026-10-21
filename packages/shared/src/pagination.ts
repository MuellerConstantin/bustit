import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Which page of a list to return; pages are numbered from 0. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

export const pageInfoSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  totalElements: z.number().int(),
  totalPages: z.number().int(),
});

export type PageInfo = z.infer<typeof pageInfoSchema>;

/** One page of a list, with what is needed to page through all of it. */
export function pageSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    content: z.array(item),
    info: pageInfoSchema,
  });
}

export type Page<T> = {
  content: T[];
  info: PageInfo;
};
