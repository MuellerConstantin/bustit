import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { UsersBocController } from './users.boc.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [MeController, UsersBocController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
