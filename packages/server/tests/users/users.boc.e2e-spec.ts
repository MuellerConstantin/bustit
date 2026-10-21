import { MAX_PAGE_SIZE, bocUserPageSchema } from '@bustit/shared';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../../src/users/index.js';
import { createPlayer, getAdmin } from '../../seed/factories.js';
import { authorizationFor } from '../utils/auth.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('/api/boc/users (e2e)', () => {
  let app: TestApp;
  let adminId: string;
  let asAdmin: string;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await getAdmin(app);
    adminId = admin.id;
    asAdmin = await authorizationFor(app, admin);
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

  function deleteUser(id: string, authorization = asAdmin) {
    return request(app.http)
      .delete(`/api/boc/users/${id}`)
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
      await deleteUser(adminId, asPlayer).expect(403);
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

  describe('DELETE /api/boc/users/:id', () => {
    it('deletes a user, who is no longer listed and can no longer log in', async () => {
      const player = await createPlayer(app);
      const asPlayer = await authorizationFor(app, player);

      await deleteUser(player.id).expect(204);

      const { content } = await listedUsers();
      expect(content.map(({ id }) => id)).not.toContain(player.id);
      await request(app.http)
        .get('/api/me')
        .set('Authorization', asPlayer)
        .expect(401);
    });

    it('rejects deleting oneself', async () => {
      await deleteUser(adminId).expect(409);
    });

    it('answers a deleted or unknown user with 404', async () => {
      const player = await createPlayer(app);
      await deleteUser(player.id).expect(204);

      await deleteUser(player.id).expect(404);
      await deleteUser('00000000-0000-7000-8000-000000000000').expect(404);
    });

    it('rejects an id that is no uuid', async () => {
      await deleteUser('not-a-uuid').expect(400);
    });
  });
});
