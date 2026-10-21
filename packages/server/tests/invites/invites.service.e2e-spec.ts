import { MAX_PAGE_SIZE } from '@bustit/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InvalidInviteError,
  InviteNotFoundError,
  InviteUsedError,
  InvitesService,
  hashInviteCode,
  invites,
} from '../../src/invites/index.js';
import {
  TEST_INVITE_TITLE,
  createPlayer,
  getAdmin,
} from '../utils/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('InvitesService', () => {
  let app: TestApp;
  let service: InvitesService;
  let adminId: string;
  let adminUsername: string;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(InvitesService);
    ({ id: adminId, username: adminUsername } = await getAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  async function inviteOf(code: string) {
    const [invite] = await app.db
      .select()
      .from(invites)
      .where(eq(invites.codeHash, hashInviteCode(code)));
    return invite!;
  }

  async function expire(inviteId: string): Promise<void> {
    await app.db
      .update(invites)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(invites.id, inviteId));
  }

  /** Claims the invite and marks it used by a new player, as registering does. */
  async function useUp(code: string) {
    const player = await createPlayer(app);

    await app.db.transaction(async (tx) => {
      const invite = await service.claim(code, tx);
      await service.markUsed(invite.id, player.id, tx);
    });

    return player;
  }

  /** The newest invites, enough to include those a test just created. */
  async function listNewest() {
    return (await service.list({ page: 0, perPage: MAX_PAGE_SIZE })).invites;
  }

  function claim(code: string) {
    return app.db.transaction((tx) => service.claim(code, tx));
  }

  describe('create', () => {
    it('stores the title', async () => {
      const { invite } = await service.create(adminId, 'Max from the club');

      expect(invite.title).toBe('Max from the club');
    });

    it('stores only the hash of the code', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);

      expect(invite.codeHash).toBe(hashInviteCode(code));
      expect(JSON.stringify(await inviteOf(code))).not.toContain(code);
    });

    it('expires after the configured days', async () => {
      const { invite } = await service.create(adminId, TEST_INVITE_TITLE);
      const days =
        (invite.expiresAt.getTime() - invite.createdAt.getTime()) /
        (24 * 60 * 60 * 1000);

      expect(days).toBeCloseTo(7);
      expect(invite).toMatchObject({
        createdBy: adminId,
        usedAt: null,
        usedBy: null,
      });
    });
  });

  describe('claim and markUsed', () => {
    it('use up an open invite', async () => {
      const { code } = await service.create(adminId, TEST_INVITE_TITLE);

      const player = await useUp(code);

      expect(await inviteOf(code)).toMatchObject({ usedBy: player.id });
      expect((await inviteOf(code)).usedAt).toBeInstanceOf(Date);
    });

    it('accept the code as typed by a user', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);
      const typed = code.replace(/^BJ-/, '').replaceAll('-', ' ').toLowerCase();

      await expect(claim(typed)).resolves.toEqual({ id: invite.id });
    });

    it('reject an unknown code', async () => {
      await expect(claim('BJ-0000-0000-0000')).rejects.toThrow(
        InvalidInviteError,
      );
    });

    it('reject a used code', async () => {
      const { code } = await service.create(adminId, TEST_INVITE_TITLE);
      await useUp(code);

      await expect(claim(code)).rejects.toThrow(InvalidInviteError);
    });

    it('reject an expired code', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);
      await expire(invite.id);

      await expect(claim(code)).rejects.toThrow(InvalidInviteError);
    });
  });

  describe('list', () => {
    it('lists invites newest first with their status', async () => {
      const open = await service.create(adminId, TEST_INVITE_TITLE);
      const used = await service.create(adminId, TEST_INVITE_TITLE);
      const revoked = await service.create(adminId, TEST_INVITE_TITLE);
      const expired = await service.create(adminId, TEST_INVITE_TITLE);

      await useUp(used.code);
      await service.revoke(revoked.invite.id);
      await expire(expired.invite.id);

      const ids = [open, used, revoked, expired].map(({ invite }) => invite.id);
      const listed = (await listNewest()).filter(({ id }) => ids.includes(id));

      expect(listed.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: expired.invite.id, status: 'expired' },
        { id: revoked.invite.id, status: 'revoked' },
        { id: used.invite.id, status: 'used' },
        { id: open.invite.id, status: 'open' },
      ]);
    });

    it('names the users who created and used an invite', async () => {
      const open = await service.create(adminId, TEST_INVITE_TITLE);
      const used = await service.create(adminId, TEST_INVITE_TITLE);
      const player = await useUp(used.code);

      const listed = await listNewest();

      expect(listed.find(({ id }) => id === open.invite.id)).toMatchObject({
        createdBy: adminId,
        createdByUsername: adminUsername,
        usedBy: null,
        usedByUsername: null,
      });
      expect(listed.find(({ id }) => id === used.invite.id)).toMatchObject({
        usedBy: player.id,
        usedByUsername: player.username,
      });
    });

    it('returns one page and the total count', async () => {
      const before = (await service.list({ page: 0, perPage: 1 }))
        .totalElements;
      const oldest = await service.create(adminId, TEST_INVITE_TITLE);
      const middle = await service.create(adminId, TEST_INVITE_TITLE);
      const newest = await service.create(adminId, TEST_INVITE_TITLE);

      const first = await service.list({ page: 0, perPage: 2 });
      const second = await service.list({ page: 1, perPage: 2 });

      expect(first.totalElements).toBe(before + 3);
      expect(first.invites.map(({ id }) => id)).toEqual([
        newest.invite.id,
        middle.invite.id,
      ]);
      expect(second.invites[0]?.id).toBe(oldest.invite.id);
    });

    it('filters by status, the total count included', async () => {
      const open = await service.create(adminId, TEST_INVITE_TITLE);
      const revoked = await service.create(adminId, TEST_INVITE_TITLE);
      await service.revoke(revoked.invite.id);

      const result = await service.list({
        filter: 'status==revoked',
        page: 0,
        perPage: MAX_PAGE_SIZE,
      });
      const ids = result.invites.map(({ id }) => id);

      expect(ids).toContain(revoked.invite.id);
      expect(ids).not.toContain(open.invite.id);
      expect(result.invites.every(({ status }) => status === 'revoked')).toBe(
        true,
      );
      expect(result.totalElements).toBe(result.invites.length);
    });

    it('keeps a used invite used once it expires', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);
      await useUp(code);
      await expire(invite.id);

      const listed = (await listNewest()).find(({ id }) => id === invite.id);

      expect(listed?.status).toBe('used');
    });
  });

  describe('revoke', () => {
    it('makes the code unusable', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);

      await service.revoke(invite.id);

      expect((await inviteOf(code)).revokedAt).toBeInstanceOf(Date);
      await expect(claim(code)).rejects.toThrow(InvalidInviteError);
    });

    it('keeps the first revocation when revoked again', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);
      await service.revoke(invite.id);
      const { revokedAt } = await inviteOf(code);

      await service.revoke(invite.id);

      expect((await inviteOf(code)).revokedAt).toEqual(revokedAt);
    });

    it('rejects a used invite', async () => {
      const { invite, code } = await service.create(adminId, TEST_INVITE_TITLE);
      await useUp(code);

      await expect(service.revoke(invite.id)).rejects.toThrow(InviteUsedError);
      expect((await inviteOf(code)).revokedAt).toBeNull();
    });

    it('rejects an unknown invite', async () => {
      await expect(
        service.revoke('00000000-0000-7000-8000-000000000000'),
      ).rejects.toThrow(InviteNotFoundError);
    });
  });
});
