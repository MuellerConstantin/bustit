import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LedgerService } from '../../src/ledger/index.js';
import { createPlayer, getAdmin } from '../../seed/factories.js';
import { authorizationFor } from '../utils/auth.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('GET /api/me (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function getMe(authorization?: string) {
    const call = request(app.http).get('/api/me');
    return authorization ? call.set('Authorization', authorization) : call;
  }

  it('requires a login', async () => {
    await getMe().expect(401);
  });

  it("returns the user's own profile", async () => {
    const player = await createPlayer(app);

    await getMe(await authorizationFor(app, player)).expect(200, {
      id: player.id,
      username: player.username,
      role: 'player',
      balance: 1000,
    });
  });

  it('returns the current balance', async () => {
    const player = await createPlayer(app);
    await app
      .get(LedgerService)
      .book({ userId: player.id, delta: -250, reason: 'bet' });

    const response = await getMe(await authorizationFor(app, player)).expect(
      200,
    );

    expect(response.body).toMatchObject({ balance: 750 });
  });

  it('returns the role of an admin', async () => {
    const admin = await getAdmin(app);

    const response = await getMe(await authorizationFor(app, admin)).expect(
      200,
    );

    expect(response.body).toMatchObject({ role: 'admin' });
  });
});
