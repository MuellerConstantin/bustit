import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  type CreateInviteRequest,
  type CreatedInvite as CreatedInviteResponse,
  type Invite as InviteResponse,
  createInviteRequestSchema,
} from '@bustit/shared';
import { z } from 'zod';
// Imported from the files rather than the auth module's index, which imports
// this module in turn.
import { type AuthenticatedUser, CurrentUser } from '../auth/current-user.js';
import { Roles } from '../auth/roles.js';
import { ZodValidationPipe } from '../infrastructure/validation/index.js';
import {
  toCreatedInviteResponse,
  toInviteResponse,
} from './invite-response.js';
import { InviteNotFoundError, InviteUsedError } from './invites.errors.js';
import { InvitesService } from './invites.service.js';

/** Invites in the operations console. */
@Roles('admin')
@Controller('boc/invites')
export class BocInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /** The response is the only time the plain code is available. */
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInviteRequestSchema))
    body: CreateInviteRequest,
  ): Promise<CreatedInviteResponse> {
    const { invite, code } = await this.invitesService.create(
      user.id,
      body.title,
    );
    return toCreatedInviteResponse(invite, code, user);
  }

  @Get()
  async list(): Promise<InviteResponse[]> {
    const invites = await this.invitesService.list();
    return invites.map(toInviteResponse);
  }

  /** Revoking keeps the invite listed, so this isn't a DELETE. */
  @Post(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
  ): Promise<void> {
    try {
      await this.invitesService.revoke(id);
    } catch (error) {
      if (error instanceof InviteNotFoundError) {
        throw new NotFoundException('No such invite');
      }

      if (error instanceof InviteUsedError) {
        throw new ConflictException('The invite is used already');
      }

      throw error;
    }
  }
}
