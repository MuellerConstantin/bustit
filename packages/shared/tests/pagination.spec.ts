import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  pageQuerySchema,
} from '../src/pagination.js';

describe('pageQuerySchema', () => {
  it('defaults to the first page of the default size', () => {
    expect(pageQuerySchema.parse({})).toEqual({
      page: 0,
      perPage: DEFAULT_PAGE_SIZE,
    });
  });

  it('reads numbers from query strings', () => {
    expect(pageQuerySchema.parse({ page: '2', perPage: '50' })).toEqual({
      page: 2,
      perPage: 50,
    });
  });

  it.each([
    { page: -1 },
    { page: 1.5 },
    { page: 'abc' },
    { perPage: 0 },
    { perPage: MAX_PAGE_SIZE + 1 },
  ])('rejects %j', (query) => {
    expect(pageQuerySchema.safeParse(query).success).toBe(false);
  });
});
