import {
  MAX_PAGE_SIZE,
  bocTablePageSchema,
  bocTableSchema,
} from '@bustit/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPlayer,
  createTable,
  getAdmin,
  uniqueTableName,
} from '../../seed/factories.js';
import { authorizationFor } from '../utils/auth.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('/api/boc/tables (e2e)', () => {
  let app: TestApp;
  let asAdmin: string;

  beforeAll(async () => {
    app = await createTestApp();
    asAdmin = await authorizationFor(app, await getAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  function tableBody(body: object = {}) {
    return {
      name: uniqueTableName(),
      seats: 5,
      minBet: 10,
      maxBet: 500,
      ...body,
    };
  }

  function postTable(body: object = tableBody(), authorization = asAdmin) {
    return request(app.http)
      .post('/api/boc/tables')
      .set('Authorization', authorization)
      .send(body);
  }

  function listTables(query: object = {}) {
    return request(app.http)
      .get('/api/boc/tables')
      .query({ perPage: MAX_PAGE_SIZE, ...query })
      .set('Authorization', asAdmin);
  }

  async function listedTables(query?: object) {
    const response = await listTables(query).expect(200);
    return bocTablePageSchema.parse(response.body);
  }

  function close(id: string) {
    return request(app.http)
      .post(`/api/boc/tables/${id}/close`)
      .set('Authorization', asAdmin);
  }

  async function statusOf(id: string): Promise<string | undefined> {
    const { content } = await listedTables();
    return content.find((table) => table.id === id)?.status;
  }

  describe('access', () => {
    it('requires a login', async () => {
      await request(app.http).get('/api/boc/tables').expect(401);
      await request(app.http).post('/api/boc/tables').expect(401);
    });

    it('is forbidden for players', async () => {
      const asPlayer = await authorizationFor(app, await createPlayer(app));

      await request(app.http)
        .get('/api/boc/tables')
        .set('Authorization', asPlayer)
        .expect(403);
      await postTable(tableBody(), asPlayer).expect(403);
    });
  });

  describe('POST /api/boc/tables', () => {
    it('creates an open table', async () => {
      const body = tableBody({ seats: 7, minBet: 25, maxBet: 1000 });

      const response = await postTable(body).expect(201);

      expect(bocTableSchema.parse(response.body)).toMatchObject({
        ...body,
        status: 'open',
        closedAt: null,
      });
    });

    it('trims the name', async () => {
      const name = uniqueTableName();

      const response = await postTable(tableBody({ name: `  ${name}  ` }));

      expect(bocTableSchema.parse(response.body).name).toBe(name);
    });

    it('accepts equal bet limits', async () => {
      await postTable(tableBody({ minBet: 100, maxBet: 100 })).expect(201);
    });

    it.each([
      { name: undefined },
      { name: '   ' },
      { name: 'a'.repeat(51) },
      { seats: 0 },
      { seats: 8 },
      { seats: 2.5 },
      { minBet: 0 },
      { minBet: '10' },
      { minBet: 100, maxBet: 99 },
    ])('rejects the body %j', async (body) => {
      await postTable(tableBody(body)).expect(400);
    });

    it('rejects a taken name with 409', async () => {
      const { name } = await createTable(app);

      await postTable(tableBody({ name })).expect(409);
    });
  });

  describe('GET /api/boc/tables', () => {
    it('lists open and closed tables newest first', async () => {
      const open = await createTable(app);
      const closed = await createTable(app);
      await close(closed.id).expect(204);

      const { content } = await listedTables();
      const ids = content.map(({ id }) => id);

      expect(ids.indexOf(closed.id)).toBeLessThan(ids.indexOf(open.id));
      const listed = content.find(({ id }) => id === closed.id);

      expect(listed?.status).toBe('closed');
      expect(listed?.closedAt).not.toBeNull();
    });

    it('combines the search with the status', async () => {
      const name = uniqueTableName();
      const open = await createTable(app, { name });
      const closed = await createTable(app, { name: `${name} closed` });
      await close(closed.id).expect(204);

      const { content, info } = await listedTables({
        filter: `status==open;name=like="*${name.slice(6)}*"`,
      });

      expect(content.map(({ id }) => id)).toEqual([open.id]);
      expect(info.totalElements).toBe(1);
    });

    it.each([
      { page: -1 },
      { perPage: MAX_PAGE_SIZE + 1 },
      { filter: '' },
      { filter: 'status==unknown' },
      { filter: 'seats==5' },
      { filter: 'status=like=open' },
    ])('rejects the query %j', async (query) => {
      await listTables(query).expect(400);
    });
  });

  describe('POST /api/boc/tables/:id/close', () => {
    it('closes an open table', async () => {
      const table = await createTable(app);

      await close(table.id).expect(204);

      expect(await statusOf(table.id)).toBe('closed');
    });

    it('accepts closing again', async () => {
      const table = await createTable(app);
      await close(table.id).expect(204);

      await close(table.id).expect(204);
    });

    it('answers an unknown table with 404', async () => {
      await close('00000000-0000-7000-8000-000000000000').expect(404);
    });

    it('rejects an id that is no uuid', async () => {
      await close('not-a-uuid').expect(400);
    });
  });
});
