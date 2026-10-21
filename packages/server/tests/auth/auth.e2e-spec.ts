import { Controller, Get } from '@nestjs/common';
import { type LoginResponse, loginResponseSchema } from '@bustit/shared';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type AuthenticatedUser,
  CurrentUser,
  Public,
  Roles,
} from '../../src/auth/index.js';
import type { Env } from '../../src/infrastructure/config/index.js';
import { users } from '../../src/users/index.js';
import { TEST_PASSWORD, createPlayer } from '../utils/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

/** Routes of the test's own to exercise the guard with. */
@Controller('test/auth')
class ProbeController {
  @Get('protected')
  protectedRoute(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Public()
  @Get('public')
  publicRoute(): { ok: true } {
    return { ok: true };
  }

  @Roles('admin')
  @Get('admin')
  adminRoute(): { ok: true } {
    return { ok: true };
  }
}

describe('Auth (e2e)', () => {
  let app: TestApp;
  let admin: { username: string; password: string };

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });

    const config = app.get<ConfigService<Env, true>>(ConfigService);
    admin = {
      username: config.get('ADMIN_USERNAME', { infer: true }),
      password: config.get('ADMIN_PASSWORD', { infer: true }),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  function login(credentials: { username: string; password: string }) {
    return request(app.http).post('/api/auth/login').send(credentials);
  }

  /** Logs in and returns the access token. */
  async function accessTokenOf(credentials: {
    username: string;
    password: string;
  }): Promise<string> {
    const response = await login(credentials).expect(200);
    return (response.body as LoginResponse).accessToken;
  }

  function getProtected(authorization?: string) {
    const call = request(app.http).get('/api/test/auth/protected');
    return authorization ? call.set('Authorization', authorization) : call;
  }

  async function loggedInPlayer() {
    const player = await createPlayer(app);
    const token = await accessTokenOf({
      username: player.username,
      password: TEST_PASSWORD,
    });
    return { player, authorization: `Bearer ${token}` };
  }

  describe('login', () => {
    it('returns an access token and the profile without a cookie', async () => {
      const response = await login(admin).expect(200);
      const body = loginResponseSchema.parse(response.body);

      expect(body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(body.user).toMatchObject({
        username: admin.username,
        role: 'admin',
        balance: 1000,
      });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('ignores case and surrounding spaces of the username', async () => {
      await login({
        ...admin,
        username: `  ${admin.username.toUpperCase()} `,
      }).expect(200);
    });

    it('answers a wrong password and an unknown user alike', async () => {
      const wrongPassword = await login({ ...admin, password: 'nope' });
      const unknownUser = await login({ username: 'nobody', password: 'nope' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownUser.status).toBe(401);
      expect(unknownUser.body).toEqual(wrongPassword.body);
    });

    it('rejects a deleted user like a wrong password', async () => {
      const player = await createPlayer(app);
      await app.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, player.id));

      const response = await login({
        username: player.username,
        password: TEST_PASSWORD,
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual(
        (await login({ ...admin, password: 'nope' })).body,
      );
    });

    it('rejects a disabled user like a wrong password', async () => {
      const player = await createPlayer(app);
      await app.db
        .update(users)
        .set({ disabledAt: new Date() })
        .where(eq(users.id, player.id));

      const response = await login({
        username: player.username,
        password: TEST_PASSWORD,
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual(
        (await login({ ...admin, password: 'nope' })).body,
      );
    });

    it('rejects a malformed body', async () => {
      await request(app.http)
        .post('/api/auth/login')
        .send({ username: admin.username })
        .expect(400);
    });
  });

  describe('guard', () => {
    it('lets requests without a login through to public routes', async () => {
      await request(app.http)
        .get('/api/test/auth/public')
        .expect(200, { ok: true });
    });

    it('rejects requests without a login', async () => {
      await getProtected().expect(401);
    });

    it('identifies the logged-in user', async () => {
      const { player, authorization } = await loggedInPlayer();

      await getProtected(authorization).expect(200, {
        id: player.id,
        username: player.username,
        role: 'player',
      });
    });

    it('rejects a forged token', async () => {
      await getProtected('Bearer not-a-token').expect(401);
    });

    it('ignores a token sent other than as bearer token', async () => {
      const { authorization } = await loggedInPlayer();
      const token = authorization.replace('Bearer ', '');

      await getProtected(token).expect(401);
      await request(app.http)
        .get('/api/test/auth/protected')
        .set('Cookie', `token=${token}`)
        .expect(401);
    });

    it('reads the role from the database, not the token', async () => {
      const { player, authorization } = await loggedInPlayer();
      await app.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, player.id));

      const response = await getProtected(authorization).expect(200);

      expect(response.body).toMatchObject({ role: 'admin' });
    });

    it('rejects the token once the token version is raised', async () => {
      const { player, authorization } = await loggedInPlayer();
      await app.db
        .update(users)
        .set({ tokenVersion: player.tokenVersion + 1 })
        .where(eq(users.id, player.id));

      await getProtected(authorization).expect(401);
    });

    it('rejects the token once the user is deleted', async () => {
      const { player, authorization } = await loggedInPlayer();
      await app.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, player.id));

      await getProtected(authorization).expect(401);
    });

    it('rejects the token once the user is disabled', async () => {
      const { player, authorization } = await loggedInPlayer();
      await app.db
        .update(users)
        .set({ disabledAt: new Date() })
        .where(eq(users.id, player.id));

      await getProtected(authorization).expect(401);
    });
  });

  describe('roles', () => {
    function getAdminRoute(authorization?: string) {
      const call = request(app.http).get('/api/test/auth/admin');
      return authorization ? call.set('Authorization', authorization) : call;
    }

    it('lets a user with the role through', async () => {
      const token = await accessTokenOf(admin);

      await getAdminRoute(`Bearer ${token}`).expect(200, { ok: true });
    });

    it('forbids a logged-in user without the role', async () => {
      const { authorization } = await loggedInPlayer();

      await getAdminRoute(authorization).expect(403);
    });

    it('still asks for a login first', async () => {
      await getAdminRoute().expect(401);
    });
  });
});
