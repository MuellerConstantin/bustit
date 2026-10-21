import type { BocUserPage } from '@bustit/shared';
import { useSWRConfig } from 'swr';
import useSWRInfinite, { unstable_serialize } from 'swr/infinite';
import { fetcher } from '@/lib/client/bff';
import { containsFilter } from '@/lib/rsql';

const PATH = '/boc/users';
const PER_PAGE = 20;

/** The keys of the pages of one user list, narrowed by `filter` if given. */
function pageKeysOf(filter?: string) {
  return (pageIndex: number, previous: BocUserPage | null) => {
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

interface UseUsersOptions {
  /** Lists only the users whose name contains this. */
  search?: string;
}

/**
 * The users, newest first, loaded page by page for the operations console.
 * Pages are fetched by offset, so a user registering while paging pushes the
 * later ones down by one; one that shows up twice is listed once.
 */
export function useUsers({ search }: UseUsersOptions = {}) {
  const filter = search ? containsFilter(['username'], search) : undefined;
  const { data, error, isLoading, size, setSize, mutate } =
    useSWRInfinite<BocUserPage>(pageKeysOf(filter), fetcher, {
      // Keeps the list while the next search loads, instead of a skeleton.
      keepPreviousData: true,
    });

  const users = data
    ? [
        ...new Map(
          data.flatMap(({ content }) => content).map((u) => [u.id, u]),
        ).values(),
      ]
    : undefined;
  const lastPage = data?.at(-1);

  return {
    users,
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

/** Reloads every user list, e.g. after deleting a user. */
export function useReloadUsers() {
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
