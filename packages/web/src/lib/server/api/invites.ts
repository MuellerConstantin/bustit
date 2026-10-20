import 'server-only';

import {
  type CreateInviteRequest,
  type CreatedInvite,
  createdInviteSchema,
  type Invite,
  inviteSchema,
} from '@bustit/shared';
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
