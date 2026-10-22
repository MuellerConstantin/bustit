import { Controller, Post } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth/current-user.js';
import { AuthTicketsService } from './auth-tickets.service.js';

@Controller('auth/tickets')
export class AuthTicketsController {
  constructor(private readonly authTicketsService: AuthTicketsService) {}

  /** Issues a short-lived ticket for authentication. */
  @Post()
  async create(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ ticket: string }> {
    return this.authTicketsService.issue(current.id);
  }
}
