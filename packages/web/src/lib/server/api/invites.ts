import 'server-only';

import { type Invite, inviteSchema } from '@bustit/shared';
import { z } from 'zod';
import { api, bearer } from './client';

/** All invites, newest first. Only admins may list them. */
export async function listInvites(accessToken: string): Promise<Invite[]> {
  const { data } = await api.get<unknown>('/boc/invites', bearer(accessToken));

  return z.array(inviteSchema).parse(data);
}
