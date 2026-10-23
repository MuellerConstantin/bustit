import 'client-only';

import { z } from 'zod';
import { io } from 'socket.io-client';
import { REALTIME_PATH } from '@bustit/shared';
import { issueRealtimeTicketAction } from '@/actions/realtime';

/*
 * The browser connects to the game server directly, so the address is public.
 * Next.js inlines `NEXT_PUBLIC_` variables at build time, which is why the
 * property is read literally here.
 */
export const REALTIME_URL = z
  .url()
  .parse(process.env.NEXT_PUBLIC_GAME_SERVER_URL);

export const realtimeSocket = io(REALTIME_URL, {
  path: REALTIME_PATH,
  transports: ['websocket'],
  autoConnect: false,
  auth: (callback) => {
    void issueRealtimeTicketAction().then(
      (result) => {
        callback('ticket' in result ? { ticket: result.ticket } : {});
      },
      (error: unknown) => {
        console.error('Could not get realtime ticket', error);
        callback({});
      },
    );
  },
});
