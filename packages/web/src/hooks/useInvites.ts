import type { Invite } from '@bustit/shared';
import useSWR from 'swr';
import { fetcher } from '@/lib/client/bff';

/** All invites, newest first, for the operations console. */
export function useInvites() {
  return useSWR<Invite[]>('/boc/invites', fetcher);
}
