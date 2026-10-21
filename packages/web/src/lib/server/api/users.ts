import 'server-only';

import {
  type BocUserPage,
  type PageQuery,
  bocUserPageSchema,
} from '@bustit/shared';
import { api, bearer } from './client';

/** One page of the users, newest first. Only admins may list them. */
export async function listUsers(
  accessToken: string,
  query: PageQuery,
): Promise<BocUserPage> {
  const { data } = await api.get<unknown>('/boc/users', {
    ...bearer(accessToken),
    params: query,
  });

  return bocUserPageSchema.parse(data);
}
