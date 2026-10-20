import 'server-only';

import {
  type CreateInviteRequest,
  type CreatedInvite,
  createdInviteSchema,
  type Invite,
  inviteSchema,
} from '@bustit/shared';
import { HttpStatusCode, isAxiosError } from 'axios';
import { z } from 'zod';
import { api, bearer } from './client';

/** All invites, newest first. Only admins may list them. */
export async function listInvites(accessToken: string): Promise<Invite[]> {
  const { data } = await api.get<unknown>('/boc/invites', bearer(accessToken));

  return z.array(inviteSchema).parse(data);
}

/** Creates an invite. The response is the only time its code is available. */
export async function createInvite(
  accessToken: string,
  body: CreateInviteRequest,
): Promise<CreatedInvite> {
  const { data } = await api.post<unknown>(
    '/boc/invites',
    body,
    bearer(accessToken),
  );

  return createdInviteSchema.parse(data);
}

/** What revoking an invite came to, besides a refusal of access. */
export type RevokeOutcome = 'revoked' | 'notFound' | 'used';

/** Makes an open invite unusable. A used invite can't be revoked. */
export async function revokeInvite(
  accessToken: string,
  id: string,
): Promise<RevokeOutcome> {
  try {
    await api.post(
      `/boc/invites/${encodeURIComponent(id)}/revoke`,
      undefined,
      bearer(accessToken),
    );

    return 'revoked';
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.NotFound) {
      return 'notFound';
    }

    if (status === HttpStatusCode.Conflict) {
      return 'used';
    }

    throw error;
  }
}
