import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { REALTIME_PATH } from '@bustit/shared';
import type { AuthenticatedUser } from '../../auth/index.js';
import type { RealtimeSocketData } from './realtime.adapter.js';

export type InfoResponse = {
  readonly serverTime: string;
  readonly user: AuthenticatedUser;
};

/**
 * Gateway for the live connection. Connections are checked by the
 * `RealtimeAdapter` during the handshake, so handlers only see logged-in
 * users.
 */
@WebSocketGateway({ path: REALTIME_PATH })
export class RealtimeGateway {
  /** Basic information about the server and the connection's user. */
  @SubscribeMessage('info')
  info(@ConnectedSocket() socket: Socket): InfoResponse {
    const { user } = socket.data as RealtimeSocketData;

    return { serverTime: new Date().toISOString(), user };
  }
}
