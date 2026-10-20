import 'server-only';

import axios from 'axios';
import { serverEnv } from '../env';

/**
 * The game server's API as the web server calls it. Browsers only talk to the
 * web server, which offers one function per use case instead of passing
 * requests through, so nothing reaches the game server that the web app
 * doesn't call on purpose.
 */
export const api = axios.create({
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  config.baseURL = `${serverEnv().SERVER_URL}/api`;

  return config;
});

/** Request options that make a call on behalf of the user the token belongs to. */
export function bearer(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}
