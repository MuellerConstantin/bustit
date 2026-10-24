import { randomBytes } from 'node:crypto';
import { createSeededRng } from '@bustit/engine';
import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/index.js';
import { TablesModule } from '../tables/index.js';
import { PlayGateway } from './play.gateway.js';
import { PlayService, ROUND_RNG } from './play.service.js';

@Module({
  imports: [LedgerModule, TablesModule],
  providers: [
    PlayService,
    PlayGateway,
    {
      provide: ROUND_RNG,
      useFactory: () => createSeededRng(randomBytes(32).toString('hex')),
    },
  ],
  exports: [PlayService],
})
export class PlayModule {}
