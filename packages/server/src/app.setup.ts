import type { INestApplication } from '@nestjs/common';
import { RealtimeAdapter } from './infrastructure/realtime/index.js';

/**
 * Setup shared by the server and the e2e tests, which create the app without
 * going through `main.ts`.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useWebSocketAdapter(new RealtimeAdapter(app));
}
