import { Module } from '@nestjs/common';
import { InvitesBocController } from './invites.boc.controller.js';
import { InvitesService } from './invites.service.js';

@Module({
  controllers: [InvitesBocController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
