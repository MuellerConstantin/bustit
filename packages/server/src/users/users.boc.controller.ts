import { Controller, Get, Query } from '@nestjs/common';
import { type PageQuery, type BocUserPage, pageQuerySchema } from '@bustit/shared';
// Imported from the file rather than the auth module's index, which imports
// this module in turn.
import { Roles } from '../auth/roles.js';
import { pageOf } from '../infrastructure/pagination/index.js';
import { ZodValidationPipe } from '../infrastructure/validation/index.js';
import { toBocUser } from './boc-user.js';
import { UsersService } from './users.service.js';

/** Users in the operations console. */
@Roles('admin')
@Controller('boc/users')
export class UsersBocController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<BocUserPage> {
    const { users, totalElements } = await this.usersService.list(query);
    return pageOf(users.map(toBocUser), totalElements, query);
  }
}
