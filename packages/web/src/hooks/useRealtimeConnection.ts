import { REALTIME_PATH } from '@bustit/shared';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { issueRealtimeTicketAction } from '@/actions/realtime';
import { REALTIME_URL } from '@/lib/client/realtime';

/**
 * The ticket for the next connection attempt. Without one the server refuses
 * the connection, so a failed request leaves the handshake empty.
 */
async function ticketForAttempt(): Promise<{ ticket?: string }> {
  const result = await issueRealtimeTicketAction();

  return 'ticket' in result ? { ticket: result.ticket } : {};
}

/**
 * Keeps a live connection to the game server while the component is mounted.
 * Every attempt, including a reconnect, asks for a fresh ticket, since a
 * ticket works only once.
 */
export function useRealtimeConnection(): void {
  useEffect(() => {
    const socket = io(REALTIME_URL, {
      path: REALTIME_PATH,
      // Only the WebSocket transport, so the handshake needs no CORS setup.
      transports: ['websocket'],
      auth: (callback) => {
        void ticketForAttempt().then(callback, (error: unknown) => {
          console.error('Could not get a ticket for the live connection', error);
          callback({});
        });
      },
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
