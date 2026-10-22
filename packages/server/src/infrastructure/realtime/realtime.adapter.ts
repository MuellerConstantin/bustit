import {
  type INestApplicationContext,
  UnauthorizedException,
} from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../auth/index.js';
import { AuthTicketsService } from '../../auth-tickets/index.js';
import { UsersService } from '../../users/index.js';

/** What the connection check leaves on every authenticated socket. */
export type RealtimeSocketData = {
  readonly user: AuthenticatedUser;
};

export class RealtimeAdapter extends IoAdapter {
  private readonly authTicketsService: AuthTicketsService;
  private readonly usersService: UsersService;

  constructor(app: INestApplicationContext) {
    super(app);
    this.authTicketsService = app.get(AuthTicketsService, { strict: false });
    this.usersService = app.get(UsersService, { strict: false });
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options);

    server.use((socket, next) => {
      /*
       * Checks the connection ticket of every Socket.IO connection before a gateway
       * sees it. The check sits on the server here, not in each gateway, because
       * Nest runs `afterInit` once per gateway on the same server. A single-use
       * ticket would then be consumed by the first middleware and rejected by the
       * next.
       */
      this.authenticate(socket).then(
        () => next(),
        () => next(new Error('unauthorized')),
      );
    });

    return server;
  }

  /** Stores the logged-in user on the socket, or throws if there is none. */
  private async authenticate(socket: Socket): Promise<void> {
    const ticket: unknown = socket.handshake.auth.ticket;
    const userId =
      typeof ticket === 'string'
        ? await this.authTicketsService.consume(ticket)
        : null;
    const user = userId && (await this.usersService.findById(userId));

    if (!user || user.disabledAt) {
      throw new UnauthorizedException();
    }

    const authenticated: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    socket.data = { user: authenticated };
  }
}
