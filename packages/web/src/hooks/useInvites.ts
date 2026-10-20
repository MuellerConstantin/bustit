import type { Invite } from '@bustit/shared';
import useSWR from 'swr';
import { fetcher } from '@/lib/client/bff';

/** SWR key of the invite list, to reload it after a change. */
export const INVITES_KEY = '/boc/invites';

/** All invites, newest first, for the operations console. */
export function useInvites() {
  return useSWR<Invite[]>(INVITES_KEY, fetcher);
}
