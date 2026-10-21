import 'server-only';

import {
  type BocUserPage,
  type ListUsersQuery,
  bocUserPageSchema,
} from '@bustit/shared';
import { HttpStatusCode, isAxiosError } from 'axios';
import { api, bearer } from './client';

/** One page of the users, newest first. Only admins may list them. */
export async function listUsers(
  accessToken: string,
  query: ListUsersQuery,
): Promise<BocUserPage> {
  const { data } = await api.get<unknown>('/boc/users', {
    ...bearer(accessToken),
    params: query,
  });

  return bocUserPageSchema.parse(data);
}

/** What deleting a user came to, besides a refusal of access. */
export type DeleteUserOutcome = 'deleted' | 'notFound' | 'self';

/** Deletes a user, which ends their logins. Admins can't delete themselves. */
export async function deleteUser(
  accessToken: string,
  id: string,
): Promise<DeleteUserOutcome> {
  try {
    await api.delete(
      `/boc/users/${encodeURIComponent(id)}`,
      bearer(accessToken),
    );

    return 'deleted';
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.NotFound) {
      return 'notFound';
    }

    if (status === HttpStatusCode.Conflict) {
      return 'self';
    }

    throw error;
  }
}
