import { MAX_PAGE_SIZE, type TablePage } from '@bustit/shared';
import useSWR from 'swr';
import { fetcher } from '@/lib/client/bff';

/**
 * The open tables, newest first, for the lobby. Only the first page is
 * loaded, as a group has far fewer tables than fit on it; `totalElements`
 * tells if there are more.
 */
export function useOpenTables() {
  const { data, error, isLoading, mutate } = useSWR<TablePage>(
    `/tables?perPage=${MAX_PAGE_SIZE}`,
    fetcher,
  );

  return {
    tables: data?.content,
    totalElements: data?.info.totalElements,
    isLoading,
    error: error as unknown,
    reload: () => mutate(),
  };
}
