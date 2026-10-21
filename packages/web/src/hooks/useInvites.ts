import type { InvitePage, InviteStatus } from '@bustit/shared';
import { useSWRConfig } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { fetcher } from '@/lib/client/bff';

const PATH = '/boc/invites';
const PER_PAGE = 20;

interface UseInvitesOptions {
  /** Lists only the invites with this status. */
  status?: InviteStatus;
}

/**
 * The invites, newest first, loaded page by page for the operations console.
 * Pages are fetched by offset, so an invite created while paging pushes the
 * later ones down by one; one that shows up twice is listed once.
 */
export function useInvites({ status }: UseInvitesOptions = {}) {
  const { data, error, isLoading, size, setSize, mutate } =
    useSWRInfinite<InvitePage>((pageIndex, previous: InvitePage | null) => {
      if (previous && previous.info.page + 1 >= previous.info.totalPages) {
        return null;
      }

      const params = new URLSearchParams({
        page: String(pageIndex),
        perPage: String(PER_PAGE),
        ...(status && { filter: `status==${status}` }),
      });

      return `${PATH}?${params}`;
    }, fetcher);

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

/** Reloads every invite list, e.g. after creating or revoking an invite. */
export function useReloadInvites() {
  const { mutate } = useSWRConfig();

  return () => mutate((key) => typeof key === 'string' && key.includes(PATH));
}
