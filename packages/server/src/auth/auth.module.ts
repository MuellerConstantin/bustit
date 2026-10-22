import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InvitesModule } from '../invites/index.js';
import { LedgerModule } from '../ledger/index.js';
import { UsersModule } from '../users/index.js';
import { AccountService } from './account.service.js';
import { AdminBootstrapService } from './admin-bootstrap.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';
import { AuthTicketsModule } from '../auth-tickets/auth-tickets.module.js';

@Module({
  imports: [UsersModule, LedgerModule, InvitesModule, AuthTicketsModule],
  controllers: [AuthController, RegistrationController],
  providers: [
    AccountService,
    AdminBootstrapService,
    AuthTokenService,
    RegistrationService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AccountService, AuthTokenService, RegistrationService],
})
export class AuthModule {}
