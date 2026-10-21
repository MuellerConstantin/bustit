import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import type { OwnUser } from '@bustit/shared';
// Imported from the file rather than the auth module's index, which imports
// this module in turn.
import { type AuthenticatedUser, CurrentUser } from '../auth/current-user.js';
import { toOwnUser } from './own-user.js';
import { UsersService } from './users.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  /** The logged-in user's own profile, with the current balance. */
  @Get()
  async get(@CurrentUser() current: AuthenticatedUser): Promise<OwnUser> {
    const user = await this.usersService.findById(current.id);

    /*
     * The guard found the user a moment ago; this only covers a deletion in
     * between.
     */
    if (!user) {
      throw new UnauthorizedException();
    }

    return toOwnUser(user);
  }
}
