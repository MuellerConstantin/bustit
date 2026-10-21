import type {
  CreatedInvite as CreatedInviteResponse,
  Invite as InviteResponse,
  PublicUser,
} from '@bustit/shared';
import type { Invite } from './invites.schema.js';
import type { ListedInvite } from './invites.service.js';

/** Leaves out the code hash, which has no use outside the server. */
export function toInviteResponse(invite: ListedInvite): InviteResponse {
  return {
    id: invite.id,
    title: invite.title,
    status: invite.status,
    createdBy: { id: invite.createdBy, username: invite.createdByUsername },
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: invite.usedAt?.toISOString() ?? null,
    usedBy:
      invite.usedBy && invite.usedByUsername
        ? { id: invite.usedBy, username: invite.usedByUsername }
        : null,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
  };
}

/** A new invite is open and unused, so its creator is all there is to add. */
export function toCreatedInviteResponse(
  invite: Invite,
  code: string,
  creator: PublicUser,
): CreatedInviteResponse {
  return {
    invite: toInviteResponse({
      ...invite,
      status: 'open',
      createdByUsername: creator.username,
      usedByUsername: null,
    }),
    code,
  };
}
