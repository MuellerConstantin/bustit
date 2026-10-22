import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/index.js';
import { validateEnv } from './infrastructure/config/index.js';
import { DatabaseModule } from './infrastructure/database/index.js';
import { HealthModule } from './infrastructure/health/index.js';
import { LoggingModule } from './infrastructure/logging/index.js';
import { InvitesModule } from './invites/index.js';
import { TablesModule } from './tables/index.js';
import { UsersModule } from './users/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV}.local`,
        `.env.${process.env.NODE_ENV}`,
        '.env.local',
        '.env',
      ],
      validate: validateEnv,
    }),
    LoggingModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    InvitesModule,
    TablesModule,
  ],
})
export class AppModule {}
