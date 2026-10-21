import { MAX_PAGE_SIZE, bocUserPageSchema } from '@bustit/shared';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../../src/users/index.js';
import {
  authorizationFor,
  createPlayer,
  getAdmin,
} from '../utils/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('/api/boc/users (e2e)', () => {
  let app: TestApp;
  let asAdmin: string;

  beforeAll(async () => {
    app = await createTestApp();
    asAdmin = await authorizationFor(app, await getAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  function listUsers(query: object = {}, authorization = asAdmin) {
    return request(app.http)
      .get('/api/boc/users')
      .query({ perPage: MAX_PAGE_SIZE, ...query })
      .set('Authorization', authorization);
  }

  async function listedUsers(query?: object) {
    const response = await listUsers(query).expect(200);
    return bocUserPageSchema.parse(response.body);
  }

  describe('access', () => {
    it('requires a login', async () => {
      await request(app.http).get('/api/boc/users').expect(401);
    });

    it('is forbidden for players', async () => {
      const asPlayer = await authorizationFor(app, await createPlayer(app));

      await listUsers({}, asPlayer).expect(403);
    });
  });

  describe('GET /api/boc/users', () => {
    it('lists users newest first without secrets', async () => {
      const first = await createPlayer(app);
      const second = await createPlayer(app);

      const response = await listUsers().expect(200);
      const { content } = bocUserPageSchema.parse(response.body);
      const ids = content.map(({ id }) => id);

      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
      expect(content.find(({ id }) => id === first.id)).toEqual({
        id: first.id,
        username: first.username,
        role: 'player',
        balance: 1000,
        createdAt: first.createdAt.toISOString(),
        disabledAt: null,
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /passwordHash|password_hash|tokenVersion|token_version/,
      );
    });

    it('includes when a user was disabled', async () => {
      const player = await createPlayer(app);
      const [disabled] = await app.db
        .update(users)
        .set({ disabledAt: sql`now()` })
        .where(eq(users.id, player.id))
        .returning();

      const { content } = await listedUsers();

      expect(content.find(({ id }) => id === player.id)?.disabledAt).toBe(
        disabled!.disabledAt!.toISOString(),
      );
    });

    it('pages through the users', async () => {
      await createPlayer(app);
      await createPlayer(app);
      await createPlayer(app);

      const all = await listedUsers();
      const page = await listedUsers({ page: 1, perPage: 2 });

      expect(page.info).toEqual({
        page: 1,
        perPage: 2,
        totalElements: all.info.totalElements,
        totalPages: Math.ceil(all.info.totalElements / 2),
      });
      expect(page.content.map(({ id }) => id)).toEqual(
        all.content.slice(2, 4).map(({ id }) => id),
      );
    });

    it.each([{ page: -1 }, { perPage: 0 }, { perPage: MAX_PAGE_SIZE + 1 }])(
      'rejects the query %j',
      async (query) => {
        await listUsers(query).expect(400);
      },
    );
  });
});
