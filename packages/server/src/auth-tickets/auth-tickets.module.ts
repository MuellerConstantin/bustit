import { Module } from '@nestjs/common';
import { AuthTicketsService } from './auth-tickets.service.js';
import { AuthTicketsController } from './auth-tickets.controller.js';

@Module({
  controllers: [AuthTicketsController],
  providers: [AuthTicketsService],
  exports: [AuthTicketsService],
})
export class AuthTicketsModule {}
