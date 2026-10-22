import type { Table } from '@bustit/shared';
import { HttpStatusCode, isAxiosError } from 'axios';
import useSWR from 'swr';
import { fetcher } from '@/lib/client/bff';

function isNotFound(error: unknown): boolean {
  return (
    isAxiosError(error) && error.response?.status === HttpStatusCode.NotFound
  );
}

/** An open table. `isNotFound` is set if it is unknown or was closed. */
export function useTable(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Table>(
    `/tables/${encodeURIComponent(id)}`,
    fetcher,
    // Asking again won't bring back a table that doesn't exist or was closed.
    { shouldRetryOnError: (error) => !isNotFound(error) },
  );

  return {
    table: data,
    isLoading,
    isNotFound: isNotFound(error),
    error: error as unknown,
    reload: () => mutate(),
  };
}
