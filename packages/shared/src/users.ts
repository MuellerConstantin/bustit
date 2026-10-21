import { z } from 'zod';
import { pageSchema } from './pagination.js';

/** What a user sees about their own account. */
export const userProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'player']),
  balance: z.number().int(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

/** Another user as far as a list needs them, e.g. who created an invite. */
export const userReferenceSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export type UserReference = z.infer<typeof userReferenceSchema>;

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

export const bocUserPageSchema = pageSchema(bocUserSchema);

export type BocUserPage = z.infer<typeof bocUserPageSchema>;
