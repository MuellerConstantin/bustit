import 'server-only';

import { z } from 'zod';
import { api, bearer } from './client';

const authTicketSchema = z.object({ ticket: z.string() });

/** A single-use ticket that opens one live connection of the user. */
export async function issueAuthTicket(accessToken: string): Promise<string> {
  const { data } = await api.post<unknown>(
    '/auth/tickets',
    undefined,
    bearer(accessToken),
  );

  return authTicketSchema.parse(data).ticket;
}
