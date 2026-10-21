import type { Page, PageQuery } from '@bustit/shared';

/** Wraps one page of a list with what is needed to page through all of it. */
export function pageOf<T>(
  content: T[],
  totalElements: number,
  { page, perPage }: PageQuery,
): Page<T> {
  return {
    content,
    info: {
      page,
      perPage,
      totalElements,
      totalPages: Math.ceil(totalElements / perPage),
    },
  };
}
