import { loginResponseSchema } from '@bustit/shared';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InvitesService,
  hashInviteCode,
  invites,
} from '../../src/invites/index.js';
import {
  DEFAULT_PASSWORD,
  createInvite,
  createPlayer,
  uniqueUsername,
} from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('POST /api/auth/register (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function register(body: Record<string, unknown>) {
    return request(app.http).post('/api/auth/register').send(body);
  }

  async function inviteOf(code: string) {
    const [invite] = await app.db
      .select()
      .from(invites)
      .where(eq(invites.codeHash, hashInviteCode(code)));
    return invite!;
  }

  it('creates a player and logs them in', async () => {
    const { code } = await createInvite(app);
    const username = uniqueUsername();

    const response = await register({
      inviteCode: code,
      username,
      password: DEFAULT_PASSWORD,
    }).expect(201);
    const body = loginResponseSchema.parse(response.body);

    expect(body.user).toMatchObject({
      username,
      role: 'player',
      balance: 1000,
    });
    expect((await inviteOf(code)).usedBy).toBe(body.user.id);

    await request(app.http)
      .get('/api/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
  });

  it('normalizes username and invite code', async () => {
    const { code } = await createInvite(app);
    const username = uniqueUsername();

    const response = await register({
      inviteCode: ` ${code.toLowerCase().replaceAll('-', ' ')} `,
      username: `  ${username.toUpperCase()} `,
      password: DEFAULT_PASSWORD,
    }).expect(201);

    expect(response.body).toMatchObject({ user: { username } });
  });

  it('answers unknown, used, revoked and expired codes alike', async () => {
    const used = await createInvite(app);
    await register({
      inviteCode: used.code,
      username: uniqueUsername(),
      password: DEFAULT_PASSWORD,
    }).expect(201);

    const revoked = await createInvite(app);
    await app.get(InvitesService).revoke(revoked.invite.id);

    const expired = await createInvite(app);
    await app.db
      .update(invites)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(invites.id, expired.invite.id));

    const responses = await Promise.all(
      ['BJ-0000-0000-0000', used.code, revoked.code, expired.code].map(
        (inviteCode) =>
          register({
            inviteCode,
            username: uniqueUsername(),
            password: DEFAULT_PASSWORD,
          }),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body).toEqual(responses[0]!.body);
    }
  });

  it('rejects a taken username and keeps the invite valid', async () => {
    const player = await createPlayer(app);
    const { code } = await createInvite(app);

    await register({
      inviteCode: code,
      username: player.username,
      password: DEFAULT_PASSWORD,
    }).expect(409);

    expect((await inviteOf(code)).usedAt).toBeNull();
  });

  it.each([
    ['an invalid username', { username: 'a b' }],
    ['a short password', { password: 'short' }],
    ['a missing invite code', { inviteCode: undefined }],
  ])('rejects %s before touching the invite', async (_, override) => {
    const { code } = await createInvite(app);

    await register({
      inviteCode: code,
      username: uniqueUsername(),
      password: DEFAULT_PASSWORD,
      ...override,
    }).expect(400);

    expect((await inviteOf(code)).usedAt).toBeNull();
  });
});
