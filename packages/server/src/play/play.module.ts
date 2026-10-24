import { randomBytes } from 'node:crypto';
import { createSeededRng } from '@bustit/engine';
import { Module } from '@nestjs/common';
import { PlayService, ROUND_RNG } from './play.service.js';

@Module({
  providers: [
    PlayService,
    {
      provide: ROUND_RNG,
      useFactory: () => createSeededRng(randomBytes(32).toString('hex')),
    },
  ],
  exports: [PlayService],
})
export class PlayModule {}
