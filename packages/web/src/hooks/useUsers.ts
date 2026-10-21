import type { BocUserPage } from '@bustit/shared';
import { useSWRConfig } from 'swr';
import useSWRInfinite, { unstable_serialize } from 'swr/infinite';
import { fetcher } from '@/lib/client/bff';

const PATH = '/boc/users';
const PER_PAGE = 20;

function pageKey(pageIndex: number, previous: BocUserPage | null) {
  if (previous && previous.info.page + 1 >= previous.info.totalPages) {
    return null;
  }

  const params = new URLSearchParams({
    page: String(pageIndex),
    perPage: String(PER_PAGE),
  });

  return `${PATH}?${params}`;
}

/**
 * The users, newest first, loaded page by page for the operations console.
 * Pages are fetched by offset, so a user registering while paging pushes the
 * later ones down by one; one that shows up twice is listed once.
 */
export function useUsers() {
  const { data, error, isLoading, size, setSize, mutate } =
    useSWRInfinite<BocUserPage>(pageKey, fetcher);

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

/** Reloads every user list, e.g. after deleting a user. */
export function useReloadUsers() {
  const { mutate } = useSWRConfig();

  /*
   * A filter passed to the global mutate skips the keys of `useSWRInfinite`,
   * so the list is addressed by the key it is cached under instead.
   */
  return () => mutate(unstable_serialize(pageKey));
}
