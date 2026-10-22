import type { BocTablePage, TableStatus } from '@bustit/shared';
import { useSWRConfig } from 'swr';
import useSWRInfinite, { unstable_serialize } from 'swr/infinite';
import { fetcher } from '@/lib/client/bff';
import { allOf, containsFilter } from '@/lib/rsql';

const PATH = '/boc/tables';
const PER_PAGE = 20;

/** The keys of the pages of one table list, narrowed by `filter` if given. */
function pageKeysOf(filter?: string) {
  return (pageIndex: number, previous: BocTablePage | null) => {
    if (previous && previous.info.page + 1 >= previous.info.totalPages) {
      return null;
    }

    const params = new URLSearchParams({
      page: String(pageIndex),
      perPage: String(PER_PAGE),
      ...(filter && { filter }),
    });

    return `${PATH}?${params}`;
  };
}

interface UseTablesOptions {
  /** Lists only the tables with this status. */
  status?: TableStatus;
  /** Lists only the tables whose name contains this. */
  search?: string;
}

/**
 * The tables, newest first, loaded page by page for the operations console.
 * Pages are fetched by offset, so a table created while paging pushes the
 * later ones down by one; one that shows up twice is listed once.
 */
export function useTables({ status, search }: UseTablesOptions = {}) {
  const filter = allOf(
    status && `status==${status}`,
    search ? containsFilter(['name'], search) : undefined,
  );
  const { data, error, isLoading, size, setSize, mutate } =
    useSWRInfinite<BocTablePage>(pageKeysOf(filter), fetcher, {
      // Keeps the list while the next search loads, instead of a skeleton.
      keepPreviousData: true,
    });

  const tables = data
    ? [
        ...new Map(
          data
            .flatMap(({ content }) => content)
            .map((table) => [table.id, table]),
        ).values(),
      ]
    : undefined;
  const lastPage = data?.at(-1);

  return {
    tables,
    totalElements: data?.[0]?.info.totalElements,
    hasMore: lastPage
      ? lastPage.info.page + 1 < lastPage.info.totalPages
      : false,
    isLoading,
    isLoadingMore: size > 0 && data?.[size - 1] === undefined && !error,
    loadMore: () => setSize(size + 1),
    error: error as unknown,
    reload: () => mutate(),
  };
}

const LIST_KEY_PREFIX = unstable_serialize(() => `${PATH}?`);

/** Reloads every table list, e.g. after creating or closing a table. */
export function useReloadTables() {
  const { cache, mutate } = useSWRConfig();

  /*
   * A filter passed to the global mutate skips the keys of `useSWRInfinite`,
   * so the lists are looked up in the cache by the prefix of their keys.
   */
  return () =>
    Promise.all(
      [...cache.keys()]
        .filter((key) => key.startsWith(LIST_KEY_PREFIX))
        .map((key) => mutate(key)),
    );
}
