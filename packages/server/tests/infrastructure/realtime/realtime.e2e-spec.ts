import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AuthTicketsService } from '../../../src/auth-tickets/index.js';
import { REALTIME_PATH } from '@bustit/shared';
import type { InfoResponse } from '../../../src/infrastructure/realtime/index.js';
import { createPlayer } from '../../../seed/factories.js';
import { type TestApp, createTestApp } from '../../utils/test-app.js';

describe('realtime connection (e2e)', () => {
  let app: TestApp;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp();

    const server = app.http as Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.close();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  /** Resolves with the connected socket, rejects with the server's error. */
  function connect(auth: Record<string, unknown>): Promise<Socket> {
    const socket = io(url, {
      path: REALTIME_PATH,
      auth,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);

    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  it('rejects a connection without a ticket', async () => {
    await expect(connect({})).rejects.toThrow('unauthorized');
  });

  it('rejects an unknown ticket', async () => {
    await expect(connect({ ticket: 'unknown' })).rejects.toThrow(
      'unauthorized',
    );
  });

  it('answers info with the server time and the connection user', async () => {
    const player = await createPlayer(app);
    const { ticket } = await app.get(AuthTicketsService).issue(player.id);

    const socket = await connect({ ticket });
    const response = (await socket
      .timeout(5000)
      .emitWithAck('info')) as InfoResponse;

    expect(Number.isNaN(Date.parse(response.serverTime))).toBe(false);
    expect(response.user).toEqual({
      id: player.id,
      username: player.username,
      role: 'player',
    });
  });

  it('accepts a ticket only once', async () => {
    const player = await createPlayer(app);
    const { ticket } = await app.get(AuthTicketsService).issue(player.id);

    await connect({ ticket });

    await expect(connect({ ticket })).rejects.toThrow('unauthorized');
  });
});
