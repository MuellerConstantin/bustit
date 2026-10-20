import 'client-only';

import axios from 'axios';

/**
 * The web app's own endpoints as the browser calls them. The browser never
 * talks to the game server; these endpoints do that on its behalf.
 */
export const bff = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

/** SWR fetcher that loads a path of the web app's API. */
export async function fetcher<T>(path: string): Promise<T> {
  const { data } = await bff.get<T>(path);

  return data;
}
