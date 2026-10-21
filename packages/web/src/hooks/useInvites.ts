import type { InvitePage, InviteStatus } from '@bustit/shared';
import { useSWRConfig } from 'swr';
import useSWRInfinite, { unstable_serialize } from 'swr/infinite';
import { fetcher } from '@/lib/client/bff';
import { allOf, containsFilter } from '@/lib/rsql';

const PATH = '/boc/invites';
const PER_PAGE = 20;
const SEARCH_FIELDS = ['title', 'createdBy.username', 'usedBy.username'];

/** The keys of the pages of one invite list, narrowed by `filter` if given. */
function pageKeysOf(filter?: string) {
  return (pageIndex: number, previous: InvitePage | null) => {
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

interface UseInvitesOptions {
  /** Lists only the invites with this status. */
  status?: InviteStatus;
  /** Lists only the invites whose title or users' names contain this. */
  search?: string;
}

/**
 * The invites, newest first, loaded page by page for the operations console.
 * Pages are fetched by offset, so an invite created while paging pushes the
 * later ones down by one; one that shows up twice is listed once.
 */
export function useInvites({ status, search }: UseInvitesOptions = {}) {
  const filter = allOf(
    status && `status==${status}`,
    search ? containsFilter(SEARCH_FIELDS, search) : undefined,
  );
  const { data, error, isLoading, size, setSize, mutate } =
    useSWRInfinite<InvitePage>(pageKeysOf(filter), fetcher, {
      // Keeps the list while the next search loads, instead of a skeleton.
      keepPreviousData: true,
    });

  const invites = data
    ? [
        ...new Map(
          data.flatMap(({ content }) => content).map((i) => [i.id, i]),
        ).values(),
      ]
    : undefined;
  const lastPage = data?.at(-1);

  return {
    invites,
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

/** Reloads every invite list, e.g. after creating or revoking an invite. */
export function useReloadInvites() {
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
