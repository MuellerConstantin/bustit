import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SelfDeletionError,
  UserNotFoundError,
  UsersService,
} from '../../src/users/index.js';
import { createPlayer, getAdmin } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('UsersService', () => {
  let app: TestApp;
  let service: UsersService;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(UsersService);
    ({ id: adminId } = await getAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('list', () => {
    it('returns one page newest first and the total count', async () => {
      const before = (await service.list({ page: 0, perPage: 1 }))
        .totalElements;
      const oldest = await createPlayer(app);
      const middle = await createPlayer(app);
      const newest = await createPlayer(app);

      const first = await service.list({ page: 0, perPage: 2 });
      const second = await service.list({ page: 1, perPage: 2 });

      expect(first.totalElements).toBe(before + 3);
      expect(first.users.map(({ id }) => id)).toEqual([newest.id, middle.id]);
      expect(second.users[0]?.id).toBe(oldest.id);
    });
  });

  describe('delete', () => {
    it('hides the user from lookups and the list', async () => {
      const player = await createPlayer(app);
      const before = (await service.list({ page: 0, perPage: 1 }))
        .totalElements;

      await service.delete(player.id, adminId);

      const after = await service.list({ page: 0, perPage: 100 });
      expect(await service.findById(player.id)).toBeNull();
      expect(await service.findByUsername(player.username)).toBeNull();
      expect(after.users.map(({ id }) => id)).not.toContain(player.id);
      expect(after.totalElements).toBe(before - 1);
    });

    it('rejects deleting oneself', async () => {
      await expect(service.delete(adminId, adminId)).rejects.toThrow(
        SelfDeletionError,
      );
      expect(await service.findById(adminId)).not.toBeNull();
    });

    it('rejects a user that is deleted already', async () => {
      const player = await createPlayer(app);
      await service.delete(player.id, adminId);

      await expect(service.delete(player.id, adminId)).rejects.toThrow(
        UserNotFoundError,
      );
    });

    it('rejects an unknown user', async () => {
      await expect(
        service.delete('00000000-0000-7000-8000-000000000000', adminId),
      ).rejects.toThrow(UserNotFoundError);
    });
  });
});
