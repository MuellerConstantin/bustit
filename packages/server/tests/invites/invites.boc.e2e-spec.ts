import {
  MAX_PAGE_SIZE,
  createdInviteSchema,
  invitePageSchema,
} from '@bustit/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RegistrationService } from '../../src/auth/index.js';
import {
  DEFAULT_INVITE_TITLE,
  DEFAULT_PASSWORD,
  createPlayer,
  getAdmin,
  uniqueUsername,
} from '../../seed/factories.js';
import { authorizationFor } from '../utils/auth.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('/api/boc/invites (e2e)', () => {
  let app: TestApp;
  let adminId: string;
  let adminUsername: string;
  let asAdmin: string;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await getAdmin(app);
    adminId = admin.id;
    adminUsername = admin.username;
    asAdmin = await authorizationFor(app, admin);
  });

  afterAll(async () => {
    await app.close();
  });

  function createInvite(
    authorization = asAdmin,
    body: object = { title: DEFAULT_INVITE_TITLE },
  ) {
    return request(app.http)
      .post('/api/boc/invites')
      .set('Authorization', authorization)
      .send(body);
  }

  function listInvites(query: object = {}) {
    return request(app.http)
      .get('/api/boc/invites')
      .query({ perPage: MAX_PAGE_SIZE, ...query })
      .set('Authorization', asAdmin);
  }

  async function listedInvites(query?: object) {
    const response = await listInvites(query).expect(200);
    return invitePageSchema.parse(response.body);
  }

  function revoke(id: string) {
    return request(app.http)
      .post(`/api/boc/invites/${id}/revoke`)
      .set('Authorization', asAdmin);
  }

  async function statusOf(id: string): Promise<string | undefined> {
    const { content } = await listedInvites();
    return content.find((invite) => invite.id === id)?.status;
  }

  describe('access', () => {
    it('requires a login', async () => {
      await request(app.http).get('/api/boc/invites').expect(401);
      await request(app.http).post('/api/boc/invites').expect(401);
    });

    it('is forbidden for players', async () => {
      const asPlayer = await authorizationFor(app, await createPlayer(app));

      await request(app.http)
        .get('/api/boc/invites')
        .set('Authorization', asPlayer)
        .expect(403);
      await createInvite(asPlayer).expect(403);
    });
  });

  describe('POST /api/boc/invites', () => {
    it('creates an open invite and returns its code once', async () => {
      const response = await createInvite().expect(201);
      const { invite, code } = createdInviteSchema.parse(response.body);

      expect(code).toMatch(/^BJ-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      expect(invite).toMatchObject({
        title: DEFAULT_INVITE_TITLE,
        status: 'open',
        createdBy: { id: adminId, username: adminUsername },
        usedAt: null,
        usedBy: null,
        revokedAt: null,
      });
    });

    it('trims the title', async () => {
      const response = await createInvite(asAdmin, { title: '  Max  ' });

      expect(createdInviteSchema.parse(response.body).invite.title).toBe('Max');
    });

    it.each([{}, { title: '   ' }, { title: 'a'.repeat(101) }])(
      'rejects the body %j',
      async (body) => {
        await createInvite(asAdmin, body).expect(400);
      },
    );

    it('creates an invite a new user can register with', async () => {
      const { code } = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );

      await expect(
        app.get(RegistrationService).register({
          inviteCode: code,
          username: uniqueUsername(),
          password: DEFAULT_PASSWORD,
        }),
      ).resolves.toMatchObject({ role: 'player' });
    });
  });

  describe('GET /api/boc/invites', () => {
    it('lists invites newest first without codes or hashes', async () => {
      const first = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );
      const second = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );

      const response = await listInvites().expect(200);
      const { content } = invitePageSchema.parse(response.body);
      const ids = content.map(({ id }) => id);

      expect(ids.indexOf(second.invite.id)).toBeLessThan(
        ids.indexOf(first.invite.id),
      );
      expect(JSON.stringify(response.body)).not.toContain(first.code);
      expect(JSON.stringify(response.body)).not.toMatch(/codeHash|code_hash/);
    });

    it('pages through the invites', async () => {
      await createInvite().expect(201);
      await createInvite().expect(201);
      await createInvite().expect(201);

      const all = await listedInvites();
      const page = await listedInvites({ page: 1, perPage: 2 });

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

    it('lists only the invites with the given status', async () => {
      const { invite } = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );
      await revoke(invite.id).expect(204);

      const { content } = await listedInvites({ filter: 'status==revoked' });

      expect(content.map(({ id }) => id)).toContain(invite.id);
      expect(content.every(({ status }) => status === 'revoked')).toBe(true);
    });

    it('combines the search with the status', async () => {
      const title = `Search ${uniqueUsername()}`;
      const open = createdInviteSchema.parse(
        (await createInvite(asAdmin, { title }).expect(201)).body,
      );
      const revoked = createdInviteSchema.parse(
        (await createInvite(asAdmin, { title }).expect(201)).body,
      );
      await revoke(revoked.invite.id).expect(204);

      const { content, info } = await listedInvites({
        filter: `status==open;title=like="*${title.slice(7)}*"`,
      });

      expect(content.map(({ id }) => id)).toEqual([open.invite.id]);
      expect(info.totalElements).toBe(1);
    });

    it.each([
      { page: -1 },
      { perPage: 0 },
      { perPage: MAX_PAGE_SIZE + 1 },
      { filter: '' },
      { filter: 'status=' },
      { filter: 'status==unknown' },
      { filter: 'codeHash==abc' },
      { filter: 'status=like=open' },
      { filter: 'title==Max' },
      { filter: 'createdBy.id==abc' },
    ])('rejects the query %j', async (query) => {
      await listInvites(query).expect(400);
    });

    it('names the user who used an invite', async () => {
      const { invite, code } = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );
      const username = uniqueUsername();
      await app.get(RegistrationService).register({
        inviteCode: code,
        username,
        password: DEFAULT_PASSWORD,
      });

      const { content } = await listedInvites();
      const listed = content.find(({ id }) => id === invite.id);

      expect(listed).toMatchObject({
        createdBy: { id: adminId, username: adminUsername },
        usedBy: { username },
      });
    });
  });

  describe('POST /api/boc/invites/:id/revoke', () => {
    it('revokes an open invite', async () => {
      const { invite } = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );

      await revoke(invite.id).expect(204);

      expect(await statusOf(invite.id)).toBe('revoked');
    });

    it('accepts revoking again', async () => {
      const { invite } = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );
      await revoke(invite.id).expect(204);

      await revoke(invite.id).expect(204);
    });

    it('rejects a used invite', async () => {
      const { invite, code } = createdInviteSchema.parse(
        (await createInvite().expect(201)).body,
      );
      await app.get(RegistrationService).register({
        inviteCode: code,
        username: uniqueUsername(),
        password: DEFAULT_PASSWORD,
      });

      await revoke(invite.id).expect(409);
      expect(await statusOf(invite.id)).toBe('used');
    });

    it('answers an unknown invite with 404', async () => {
      await revoke('00000000-0000-7000-8000-000000000000').expect(404);
    });

    it('rejects an id that is no uuid', async () => {
      await revoke('not-a-uuid').expect(400);
    });
  });
});
