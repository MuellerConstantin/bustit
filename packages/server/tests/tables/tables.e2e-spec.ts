import { MAX_PAGE_SIZE, tablePageSchema } from '@bustit/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TablesService } from '../../src/tables/index.js';
import {
  createPlayer,
  createTable,
  uniqueTableName,
} from '../../seed/factories.js';
import { authorizationFor } from '../utils/auth.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('/api/tables (e2e)', () => {
  let app: TestApp;
  let asPlayer: string;

  beforeAll(async () => {
    app = await createTestApp();
    asPlayer = await authorizationFor(app, await createPlayer(app));
  });

  afterAll(async () => {
    await app.close();
  });

  function listTables(query: object = {}) {
    return request(app.http)
      .get('/api/tables')
      .query({ perPage: MAX_PAGE_SIZE, ...query })
      .set('Authorization', asPlayer);
  }

  async function listedTables(query?: object) {
    const response = await listTables(query).expect(200);
    return tablePageSchema.parse(response.body);
  }

  it('requires a login', async () => {
    await request(app.http).get('/api/tables').expect(401);
  });

  it('lists the open tables newest first', async () => {
    const first = await createTable(app);
    const second = await createTable(app, { seats: 3, minBet: 1, maxBet: 50 });

    const { content } = await listedTables();
    const ids = content.map(({ id }) => id);

    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    expect(content.find(({ id }) => id === second.id)).toEqual({
      id: second.id,
      name: second.name,
      seats: 3,
      minBet: 1,
      maxBet: 50,
    });
  });

  it('leaves out closed tables, the total count included', async () => {
    const closed = await createTable(app);
    await app.get(TablesService).close(closed.id);

    const { content, info } = await listedTables();

    expect(content.map(({ id }) => id)).not.toContain(closed.id);
    expect(info.totalElements).toBe(content.length);
  });

  it('pages through the tables', async () => {
    await createTable(app);
    await createTable(app);
    await createTable(app);

    const all = await listedTables();
    const page = await listedTables({ page: 1, perPage: 2 });

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

  it('searches the names of the open tables', async () => {
    const name = uniqueTableName();
    const open = await createTable(app, { name });
    const closed = await createTable(app, { name: `${name} closed` });
    await app.get(TablesService).close(closed.id);
    await createTable(app);

    const { content, info } = await listedTables({
      filter: `name=like="*${name.slice(6).toUpperCase()}*"`,
    });

    expect(content.map(({ id }) => id)).toEqual([open.id]);
    expect(info.totalElements).toBe(1);
  });

  it.each([
    { page: -1 },
    { perPage: 0 },
    { perPage: MAX_PAGE_SIZE + 1 },
    { filter: '' },
    { filter: 'seats==5' },
    { filter: 'name=' },
  ])('rejects the query %j', async (query) => {
    await listTables(query).expect(400);
  });
});
