import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UsersService } from '../../src/users/index.js';
import { createPlayer } from '../utils/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('UsersService', () => {
  let app: TestApp;
  let service: UsersService;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(UsersService);
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
});
