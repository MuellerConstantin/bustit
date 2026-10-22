import 'client-only';

import { z } from 'zod';

/*
 * The browser connects to the game server directly, so the address is public.
 * Next.js inlines `NEXT_PUBLIC_` variables at build time, which is why the
 * property is read literally here.
 */
export const REALTIME_URL = z
  .url()
  .parse(process.env.NEXT_PUBLIC_GAME_SERVER_URL);
