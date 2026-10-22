'use server';

import { issueAuthTicket } from '@/lib/server/api';
import { callOnBehalf, type Refusal } from '@/lib/server/bff';

export type RealtimeTicketResult =
  { success: true; ticket: string } | { error: Refusal };

/** A ticket for the next live connection of the current user. */
export async function issueRealtimeTicketAction(): Promise<RealtimeTicketResult> {
  const result = await callOnBehalf((accessToken) =>
    issueAuthTicket(accessToken),
  );

  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, ticket: result.data };
}
