import {
  type LoginResponse,
  type Table,
  loginResponseSchema,
  tableSchema,
} from '@bustit/shared';
import { z } from 'zod';
import type { BotAccount } from './env-file.js';

const ticketResponseSchema = z.object({ ticket: z.string() });

/** Logs the account in, see `loginResponseSchema` for what comes back. */
export async function login(
  server: string,
  account: BotAccount,
): Promise<LoginResponse> {
  const response = await fetch(new URL('/api/auth/login', server), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });

  if (!response.ok) {
    throw new Error(
      `Login as ${account.username} failed with status ${response.status}`,
    );
  }

  return loginResponseSchema.parse(await response.json());
}

/** Issues the single-use ticket the live connection is opened with. */
export async function issueTicket(
  server: string,
  accessToken: string,
): Promise<string> {
  const response = await fetch(new URL('/api/auth/tickets', server), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Issuing a ticket failed with status ${response.status}`);
  }

  return ticketResponseSchema.parse(await response.json()).ticket;
}

/** The table's limits and seats, which the bot needs to place its bets. */
export async function fetchTable(
  server: string,
  accessToken: string,
  tableId: string,
): Promise<Table> {
  const response = await fetch(new URL(`/api/tables/${tableId}`, server), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Loading the table failed with status ${response.status}`);
  }

  return tableSchema.parse(await response.json());
}
