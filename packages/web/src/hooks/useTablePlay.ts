'use client';

import {
  type ActionType,
  PLAY_EVENT,
  type PlayAck,
  type PlayErrorCode,
  type RoundEventsMessage,
  type TableStateMessage,
} from '@bustit/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtime } from '@/providers/RealtimeProvider';

/** Why a message did not go through; `timeout` if the server did not answer. */
export type PlayFailure = {
  readonly error: PlayErrorCode | 'timeout';
  readonly message: string;
};

/** What a message came to: the server's state, or why it did not go through. */
export type PlayResult =
  | { readonly ok: true; readonly state?: TableStateMessage }
  | ({ readonly ok: false } & PlayFailure);

const ACK_TIMEOUT_MS = 5000;

const INFO_EVENT = 'info';

/** What the server answers the `info` message with. */
type ConnectionInfo = {
  serverTime: string;
  user: { id: string };
};

/**
 * Plays at a table over the realtime connection: joins the table while the
 * component is mounted, keeps its state up to date and sends the player's
 * messages. Every message is answered with a failure if the server rejected
 * it, which also stays in `failure` until the next message succeeds.
 */
export function useTablePlay(tableId: string) {
  const { socket, status } = useRealtime();
  const [state, setState] = useState<TableStateMessage | null>(null);
  const [events, setEvents] = useState<RoundEventsMessage | null>(null);
  const [failure, setFailure] = useState<PlayFailure | null>(null);
  const [connection, setConnection] = useState<{
    userId: string;
    clockOffsetMs: number;
  } | null>(null);

  /*
   * Joining and leaving are sent one after another. The server handles
   * messages at the same time, so a quick leave and join, as React does in
   * development, could otherwise end with the connection outside the room.
   */
  const pending = useRef<Promise<unknown>>(Promise.resolve());

  const send = useCallback(
    async (event: string, payload: object = {}): Promise<PlayResult> => {
      let result: PlayResult;

      try {
        const ack = (await socket
          .timeout(ACK_TIMEOUT_MS)
          .emitWithAck(event, { tableId, ...payload })) as PlayAck;

        result = ack.ok
          ? ack
          : { ok: false, error: ack.error, message: ack.message };
      } catch {
        result = {
          ok: false,
          error: 'timeout',
          message: 'The server did not answer',
        };
      }

      setFailure(
        result.ok ? null : { error: result.error, message: result.message },
      );

      return result;
    },
    [socket, tableId],
  );

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }

    let stale = false;

    void socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(INFO_EVENT)
      .then((info: ConnectionInfo) => {
        if (!stale) {
          setConnection({
            userId: info.user.id,
            clockOffsetMs: Date.parse(info.serverTime) - Date.now(),
          });
        }
      })
      .catch((error: unknown) => {
        console.error('Could not read the connection info', error);
      });

    return () => {
      stale = true;
    };
  }, [socket, status]);

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }

    const handleState = (message: TableStateMessage) => {
      if (message.tableId === tableId) {
        setState(message);
      }
    };
    const handleEvents = (message: RoundEventsMessage) => {
      if (message.tableId === tableId) {
        setEvents(message);
      }
    };

    socket.on(PLAY_EVENT.state, handleState);
    socket.on(PLAY_EVENT.events, handleEvents);

    const joined = pending.current.then(() => send(PLAY_EVENT.join));

    void joined.then((ack) => {
      if (ack.ok && ack.state) {
        setState(ack.state);
      }
    });

    return () => {
      socket.off(PLAY_EVENT.state, handleState);
      socket.off(PLAY_EVENT.events, handleEvents);
      pending.current = joined.then(() => send(PLAY_EVENT.leave));
    };
  }, [socket, status, tableId, send]);

  return {
    /** Who the connection is logged in as, `null` until the server told. */
    userId: connection?.userId ?? null,
    /** How far the server's clock is ahead of the browser's, to count down `timer`. */
    clockOffsetMs: connection?.clockOffsetMs ?? 0,
    status,
    state,
    /** What happened in the round the last time cards were dealt or played. */
    events,
    failure,
    sit: (seat: number) => send(PLAY_EVENT.sit, { seat }),
    stand: () => send(PLAY_EVENT.stand),
    bet: (stake: number) => send(PLAY_EVENT.bet, { stake }),
    deal: () => send(PLAY_EVENT.deal),
    act: (type: ActionType) => send(PLAY_EVENT.action, { type }),
  };
}
