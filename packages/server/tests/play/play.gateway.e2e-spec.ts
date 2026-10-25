import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { REALTIME_PATH } from '@bustit/shared';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AuthTicketsService } from '../../src/auth-tickets/index.js';
import type {
  PlayAck,
  RoundEventsMessage,
  TableStateMessage,
} from '@bustit/shared';
import type { User } from '../../src/users/index.js';
import { createPlayer, createTable } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('play gateway (e2e)', () => {
  let app: TestApp;
  let url: string;
  const sockets: Socket[] = [];
  /** The table state each connection received last. */
  const latestState = new Map<Socket, TableStateMessage>();

  beforeAll(async () => {
    app = await createTestApp({ playTimings: { actionPauseMs: 0 } });

    const server = app.http as Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.close();
    }

    latestState.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A connection logged in as the user. */
  async function connect(user: User): Promise<Socket> {
    const { ticket } = await app.get(AuthTicketsService).issue(user.id);
    const socket = io(url, {
      path: REALTIME_PATH,
      auth: { ticket },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    socket.on('table:state', (state: TableStateMessage) => {
      latestState.set(socket, state);
    });

    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function send(
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<PlayAck> {
    return socket.timeout(5000).emitWithAck(event, payload) as Promise<PlayAck>;
  }

  /** Resolves with the next message of the event; call it before sending. */
  function nextMessage<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No ${event} within 5 seconds`)),
        5000,
      );

      socket.once(event, (message: T) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  /*
   * The latest state the connection received once it satisfies the
   * condition. Other connections' broadcasts may still be on their way, so
   * tests wait for the state they expect instead of the next one.
   */
  async function stateWhere(
    socket: Socket,
    condition: (state: TableStateMessage) => boolean,
  ): Promise<TableStateMessage> {
    const deadline = Date.now() + 5000;

    for (;;) {
      const state = latestState.get(socket);

      if (state && condition(state)) {
        return state;
      }

      if (Date.now() > deadline) {
        throw new Error('The expected table state did not arrive in time');
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /** Two players at a new table, both joined. */
  async function tableWithTwoPlayers() {
    const table = await createTable(app);
    const alice = await createPlayer(app);
    const bob = await createPlayer(app);
    const aliceSocket = await connect(alice);
    const bobSocket = await connect(bob);

    for (const socket of [aliceSocket, bobSocket]) {
      await send(socket, 'table:join', { tableId: table.id });
    }

    return { table, alice, bob, aliceSocket, bobSocket };
  }

  it('joins a table and answers its state', async () => {
    const table = await createTable(app, { seats: 4 });
    const socket = await connect(await createPlayer(app));

    const ack = await send(socket, 'table:join', { tableId: table.id });

    expect(ack).toMatchObject({
      ok: true,
      state: { seats: [null, null, null, null], bets: [], round: null },
    });
  });

  it('rejects an unknown table and invalid requests', async () => {
    const socket = await connect(await createPlayer(app));

    await expect(
      send(socket, 'table:join', {
        tableId: '00000000-0000-7000-8000-000000000000',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'table_not_found' });
    await expect(
      send(socket, 'table:sit', { tableId: 'not-a-uuid', seat: 0 }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid_request' });
    await expect(send(socket, 'round:bet', undefined)).resolves.toMatchObject({
      ok: false,
      error: 'invalid_request',
    });
  });

  it('rejects messages for a table the connection has not joined', async () => {
    const table = await createTable(app);
    const socket = await connect(await createPlayer(app));

    await expect(
      send(socket, 'table:sit', { tableId: table.id, seat: 0 }),
    ).resolves.toMatchObject({ ok: false, error: 'not_joined' });
  });

  it('tells everyone at the table about a change', async () => {
    const { table, alice, aliceSocket, bobSocket } =
      await tableWithTwoPlayers();

    await send(aliceSocket, 'table:sit', { tableId: table.id, seat: 1 });

    const own = await stateWhere(
      aliceSocket,
      ({ seats }) => seats[1] === alice.id,
    );
    const seen = await stateWhere(
      bobSocket,
      ({ seats }) => seats[1] === alice.id,
    );

    expect(seen).toEqual(own);
    expect(own.players).toEqual({ [alice.id]: alice.username });
  });

  it('answers the failures of a message with a code', async () => {
    const { table, aliceSocket, bobSocket } = await tableWithTwoPlayers();
    const seat = { tableId: table.id, seat: 0 };

    await send(aliceSocket, 'table:sit', seat);

    await expect(send(bobSocket, 'table:sit', seat)).resolves.toMatchObject({
      ok: false,
      error: 'seat_taken',
    });
    await expect(
      send(aliceSocket, 'table:sit', { ...seat, seat: 1 }),
    ).resolves.toMatchObject({ ok: false, error: 'already_seated' });
    await expect(
      send(aliceSocket, 'table:sit', { ...seat, seat: 99 }),
    ).resolves.toMatchObject({ ok: false, error: 'seat_invalid' });
    await expect(
      send(aliceSocket, 'round:bet', { tableId: table.id, stake: 1 }),
    ).resolves.toMatchObject({ ok: false, error: 'bet_out_of_limits' });
    await expect(
      send(bobSocket, 'round:bet', { tableId: table.id, stake: 10 }),
    ).resolves.toMatchObject({ ok: false, error: 'not_seated' });
  });

  it('frees the seat of a user who stands up', async () => {
    const { table, aliceSocket, bobSocket } = await tableWithTwoPlayers();

    await send(aliceSocket, 'table:sit', { tableId: table.id, seat: 0 });
    await send(aliceSocket, 'table:stand', { tableId: table.id });

    await stateWhere(bobSocket, ({ seats }) => seats[0] === null);
  });

  it('keeps the seat of a user who leaves the table and comes back', async () => {
    const { table, alice, aliceSocket } = await tableWithTwoPlayers();

    await send(aliceSocket, 'table:sit', { tableId: table.id, seat: 0 });
    await send(aliceSocket, 'table:leave', { tableId: table.id });

    await expect(
      send(aliceSocket, 'table:sit', { tableId: table.id, seat: 0 }),
    ).resolves.toMatchObject({ ok: false, error: 'not_joined' });
    await expect(
      send(aliceSocket, 'table:join', { tableId: table.id }),
    ).resolves.toMatchObject({
      ok: true,
      state: { seats: [alice.id, null, null, null, null] },
    });
  });

  it('keeps the seat of a user whose connection drops until they are back', async () => {
    const { table, alice, aliceSocket } = await tableWithTwoPlayers();

    await send(aliceSocket, 'table:sit', { tableId: table.id, seat: 0 });
    aliceSocket.close();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const reconnected = await connect(alice);

    await expect(
      send(reconnected, 'table:join', { tableId: table.id }),
    ).resolves.toMatchObject({
      ok: true,
      state: { seats: [alice.id, null, null, null, null] },
    });
    await expect(
      send(reconnected, 'round:bet', { tableId: table.id, stake: 10 }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('keeps the seat while another connection of the user is at the table', async () => {
    const { table, alice, aliceSocket, bobSocket } =
      await tableWithTwoPlayers();
    const otherTab = await connect(alice);

    await send(otherTab, 'table:join', { tableId: table.id });
    await send(aliceSocket, 'table:sit', { tableId: table.id, seat: 0 });
    aliceSocket.close();
    await new Promise((resolve) => setTimeout(resolve, 200));

    await expect(
      send(bobSocket, 'table:join', { tableId: table.id }),
    ).resolves.toMatchObject({
      ok: true,
      state: { seats: [alice.id, null, null, null, null] },
    });
  });

  it('plays a round to the end without showing the shoe', async () => {
    const { table, alice, bob, aliceSocket, bobSocket } =
      await tableWithTwoPlayers();
    const socketOf = new Map([
      [alice.id, aliceSocket],
      [bob.id, bobSocket],
    ]);

    await send(aliceSocket, 'table:sit', { tableId: table.id, seat: 0 });
    await send(bobSocket, 'table:sit', { tableId: table.id, seat: 2 });
    await send(aliceSocket, 'round:bet', { tableId: table.id, stake: 10 });
    await send(bobSocket, 'round:bet', { tableId: table.id, stake: 20 });

    const events = nextMessage<RoundEventsMessage>(bobSocket, 'round:events');

    expect(
      await send(aliceSocket, 'round:deal', { tableId: table.id }),
    ).toEqual({ ok: true });

    let state = await stateWhere(aliceSocket, ({ round }) => round !== null);

    expect((await events).events.length).toBeGreaterThan(0);
    expect(state.bets).toEqual([]);

    while (state.round?.phase === 'playerTurns') {
      const { seat } = state.round.turn!;
      const player = socketOf.get(state.seats[seat]!)!;
      const before = JSON.stringify(state.round);

      expect(
        await send(player, 'round:action', {
          tableId: table.id,
          type: 'stand',
        }),
      ).toEqual({ ok: true });

      state = await stateWhere(
        player,
        ({ round }) => JSON.stringify(round) !== before,
      );
    }

    expect(state.round?.phase).toBe('settled');
    expect(state.round).not.toHaveProperty('shoe');
  });
});
