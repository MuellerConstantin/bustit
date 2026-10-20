import { z } from 'zod';

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
