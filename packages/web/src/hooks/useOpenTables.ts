import { MAX_PAGE_SIZE, type TablePage } from '@bustit/shared';
import useSWR from 'swr';
import { fetcher } from '@/lib/client/bff';
import { containsFilter } from '@/lib/rsql';

interface UseOpenTablesOptions {
  /** Lists only the tables whose name contains this. */
  search?: string;
}

/**
 * The open tables, newest first, for the lobby. Only the first page is
 * loaded, as a group has far fewer tables than fit on it; `totalElements`
 * tells if there are more.
 */
export function useOpenTables({ search }: UseOpenTablesOptions = {}) {
  const params = new URLSearchParams({
    perPage: String(MAX_PAGE_SIZE),
    ...(search && { filter: containsFilter(['name'], search) }),
  });
  const { data, error, isLoading, mutate } = useSWR<TablePage>(
    `/tables?${params}`,
    fetcher,
    // Keeps the tables while the next search loads, instead of a skeleton.
    { keepPreviousData: true },
  );

  return {
    tables: data?.content,
    totalElements: data?.info.totalElements,
    isLoading,
    error: error as unknown,
    reload: () => mutate(),
  };
}
