import 'server-only';

import {
  type BocTable,
  type BocTablePage,
  type CreateTableRequest,
  type ListTablesQuery,
  bocTablePageSchema,
  bocTableSchema,
} from '@bustit/shared';
import { HttpStatusCode, isAxiosError } from 'axios';
import { api, bearer } from './client';

/** One page of all tables, newest first. Only admins may list them. */
export async function listBocTables(
  accessToken: string,
  query: ListTablesQuery,
): Promise<BocTablePage> {
  const { data } = await api.get<unknown>('/boc/tables', {
    ...bearer(accessToken),
    params: query,
  });

  return bocTablePageSchema.parse(data);
}

/** What creating a table came to, besides a refusal of access. */
export type CreateTableOutcome =
  { created: true; table: BocTable } | { created: false; reason: 'nameTaken' };

/** Creates an open table. Names are unique, closed tables' included. */
export async function createTable(
  accessToken: string,
  body: CreateTableRequest,
): Promise<CreateTableOutcome> {
  try {
    const { data } = await api.post<unknown>(
      '/boc/tables',
      body,
      bearer(accessToken),
    );

    return { created: true, table: bocTableSchema.parse(data) };
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.Conflict) {
      return { created: false, reason: 'nameTaken' };
    }

    throw error;
  }
}

/** What closing a table came to, besides a refusal of access. */
export type CloseTableOutcome = 'closed' | 'notFound';

/** Closes a table for good. Closing a closed table again is fine. */
export async function closeTable(
  accessToken: string,
  id: string,
): Promise<CloseTableOutcome> {
  try {
    await api.post(
      `/boc/tables/${encodeURIComponent(id)}/close`,
      undefined,
      bearer(accessToken),
    );

    return 'closed';
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.NotFound) {
      return 'notFound';
    }

    throw error;
  }
}
