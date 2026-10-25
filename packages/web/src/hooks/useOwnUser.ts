'use client';

import type { OwnUser } from '@bustit/shared';
import useSWR from 'swr';
import { fetcher } from '@/lib/client/bff';

/**
 * The logged-in user's own profile with their balance. The balance changes
 * while the user plays, so `reload` asks for it again.
 */
export function useOwnUser() {
  const { data, mutate } = useSWR<OwnUser>('/me', fetcher);

  // SWR keeps `mutate` the same between renders, so effects can depend on it.
  return { user: data, reload: mutate };
}
