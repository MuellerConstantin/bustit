import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  type BocUserPage,
  type ListUsersQuery,
  listUsersQuerySchema,
} from '@bustit/shared';
import { z } from 'zod';
// Imported from the file rather than the auth module's index, which imports
// this module in turn.
import { type AuthenticatedUser, CurrentUser } from '../auth/current-user.js';
import { Roles } from '../auth/roles.js';
import { InvalidFilterError } from '../infrastructure/filtering/index.js';
import { pageOf } from '../infrastructure/pagination/index.js';
import { ZodValidationPipe } from '../infrastructure/validation/index.js';
import { toBocUser } from './boc-user.js';
import { SelfDeletionError, UserNotFoundError } from './users.errors.js';
import { UsersService } from './users.service.js';

/** Users in the operations console. */
@Roles('admin')
@Controller('boc/users')
export class UsersBocController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listUsersQuerySchema))
    query: ListUsersQuery,
  ): Promise<BocUserPage> {
    try {
      const { users, totalElements } = await this.usersService.list(query);
      return pageOf(users.map(toBocUser), totalElements, query);
    } catch (error) {
      if (error instanceof InvalidFilterError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
  ): Promise<void> {
    try {
      await this.usersService.delete(id, current.id);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException('No such user');
      }

      if (error instanceof SelfDeletionError) {
        throw new ConflictException("Admins can't delete themselves");
      }

      throw error;
    }
  }
}
