import { z } from 'zod';
import { filterQuerySchema } from './filtering.js';
import { pageQuerySchema, pageSchema } from './pagination.js';
import { userReferenceSchema } from './users.js';

export const inviteStatusSchema = z.enum([
  'open',
  'used',
  'revoked',
  'expired',
]);

export type InviteStatus = z.infer<typeof inviteStatusSchema>;

export const INVITE_TITLE_MAX_LENGTH = 100;

/** Who or what an invite is for, so admins can tell invites apart. */
export const inviteTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(INVITE_TITLE_MAX_LENGTH);

export const createInviteRequestSchema = z.object({
  title: inviteTitleSchema,
});

export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

/** An invite as the operations console shows it; never includes the code. */
export const inviteSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: inviteStatusSchema,
  createdBy: userReferenceSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  usedAt: z.iso.datetime().nullable(),
  usedBy: userReferenceSchema.nullable(),
  revokedAt: z.iso.datetime().nullable(),
});

export type Invite = z.infer<typeof inviteSchema>;

/** The plain code is only ever returned here, right after creating it. */
export const createdInviteSchema = z.object({
  invite: inviteSchema,
  code: z.string(),
});

export type CreatedInvite = z.infer<typeof createdInviteSchema>;

/** Lists invites page by page, optionally narrowed by a filter. */
export const listInvitesQuerySchema = pageQuerySchema.extend(
  filterQuerySchema.shape,
);

export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;

export const invitePageSchema = pageSchema(inviteSchema);

export type InvitePage = z.infer<typeof invitePageSchema>;
