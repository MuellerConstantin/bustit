import { z } from 'zod';
import { filterQuerySchema } from './filtering.js';
import { pageQuerySchema, pageSchema } from './pagination.js';

/** What a user sees about their own account. */
export const ownUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'player']),
  balance: z.number().int(),
});

export type OwnUser = z.infer<typeof ownUserSchema>;

/** Another user as far as a list needs them, e.g. who created an invite. */
export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;

/** A user as the operations console lists them. */
export const bocUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'player']),
  balance: z.number().int(),
  createdAt: z.iso.datetime(),
  disabledAt: z.iso.datetime().nullable(),
});

export type BocUser = z.infer<typeof bocUserSchema>;

/** Lists users page by page, optionally narrowed by a filter. */
export const listUsersQuerySchema = pageQuerySchema.extend(
  filterQuerySchema.shape,
);

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const bocUserPageSchema = pageSchema(bocUserSchema);

export type BocUserPage = z.infer<typeof bocUserPageSchema>;
