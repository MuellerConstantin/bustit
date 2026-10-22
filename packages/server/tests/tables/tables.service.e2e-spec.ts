import { MAX_PAGE_SIZE } from '@bustit/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TableNameTakenError,
  TableNotFoundError,
  TablesService,
  tables,
} from '../../src/tables/index.js';
import { createTable, uniqueTableName } from '../../seed/factories.js';
import { type TestApp, createTestApp } from '../utils/test-app.js';

describe('TablesService', () => {
  let app: TestApp;
  let service: TablesService;

  beforeAll(async () => {
    app = await createTestApp();
    service = app.get(TablesService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function tableOf(id: string) {
    const [table] = await app.db.select().from(tables).where(eq(tables.id, id));
    return table!;
  }

  describe('create', () => {
    it('stores the name, seats and bet limits as an open table', async () => {
      const name = uniqueTableName();

      const table = await service.create({
        name,
        seats: 7,
        minBet: 25,
        maxBet: 1000,
      });

      expect(table).toMatchObject({
        name,
        seats: 7,
        minBet: 25,
        maxBet: 1000,
        closedAt: null,
      });
      expect(await tableOf(table.id)).toEqual(table);
    });

    it('rejects a taken name', async () => {
      const { name } = await createTable(app);

      await expect(createTable(app, { name })).rejects.toThrow(
        TableNameTakenError,
      );
    });

    it('rejects the name of a closed table', async () => {
      const closed = await createTable(app);
      await service.close(closed.id);

      await expect(createTable(app, { name: closed.name })).rejects.toThrow(
        TableNameTakenError,
      );
    });

    it('is backed by check constraints on seats and bet limits', async () => {
      await expect(createTable(app, { seats: 8 })).rejects.toThrow();
      await expect(
        createTable(app, { minBet: 100, maxBet: 99 }),
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('lists tables newest first with their status', async () => {
      const open = await createTable(app);
      const closed = await createTable(app);
      await service.close(closed.id);

      const ids = [open.id, closed.id];
      const listed = (
        await service.list({ page: 0, perPage: MAX_PAGE_SIZE })
      ).tables.filter(({ id }) => ids.includes(id));

      expect(listed.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: closed.id, status: 'closed' },
        { id: open.id, status: 'open' },
      ]);
    });

    it('returns one page and the total count', async () => {
      const before = (await service.list({ page: 0, perPage: 1 }))
        .totalElements;
      const oldest = await createTable(app);
      const middle = await createTable(app);
      const newest = await createTable(app);

      const first = await service.list({ page: 0, perPage: 2 });
      const second = await service.list({ page: 1, perPage: 2 });

      expect(first.totalElements).toBe(before + 3);
      expect(first.tables.map(({ id }) => id)).toEqual([newest.id, middle.id]);
      expect(second.tables[0]?.id).toBe(oldest.id);
    });

    it('filters by status, the total count included', async () => {
      const open = await createTable(app);
      const closed = await createTable(app);
      await service.close(closed.id);

      const result = await service.list({
        filter: 'status==open',
        page: 0,
        perPage: MAX_PAGE_SIZE,
      });
      const ids = result.tables.map(({ id }) => id);

      expect(ids).toContain(open.id);
      expect(ids).not.toContain(closed.id);
      expect(result.tables.every(({ status }) => status === 'open')).toBe(true);
      expect(result.totalElements).toBe(result.tables.length);
    });

    it('searches the names, the total count included', async () => {
      const match = await createTable(app);
      await createTable(app);

      const result = await service.list({
        filter: `name=like="*${match.name.slice(6).toUpperCase()}*"`,
        page: 0,
        perPage: MAX_PAGE_SIZE,
      });

      expect(result.tables.map(({ id }) => id)).toEqual([match.id]);
      expect(result.totalElements).toBe(1);
    });
  });

  describe('list with openOnly', () => {
    it('leaves out closed tables, even if the filter asks for them', async () => {
      const name = uniqueTableName();
      const open = await createTable(app, { name });
      const closed = await createTable(app, { name: `${name} closed` });
      await service.close(closed.id);

      const result = await service.list(
        {
          filter: `status==closed,name=like="*${name.slice(6)}*"`,
          page: 0,
          perPage: MAX_PAGE_SIZE,
        },
        { openOnly: true },
      );

      expect(result.tables.map(({ id }) => id)).toEqual([open.id]);
      expect(result.totalElements).toBe(1);
    });
  });

  describe('findOpen', () => {
    it('finds an open table', async () => {
      const table = await createTable(app);

      await expect(service.findOpen(table.id)).resolves.toEqual(table);
    });

    it('leaves out a closed table', async () => {
      const table = await createTable(app);
      await service.close(table.id);

      await expect(service.findOpen(table.id)).resolves.toBeNull();
    });
  });

  describe('close', () => {
    it('closes an open table', async () => {
      const table = await createTable(app);

      await service.close(table.id);

      expect((await tableOf(table.id)).closedAt).toBeInstanceOf(Date);
    });

    it('keeps the first closing when closed again', async () => {
      const table = await createTable(app);
      await service.close(table.id);
      const { closedAt } = await tableOf(table.id);

      await service.close(table.id);

      expect((await tableOf(table.id)).closedAt).toEqual(closedAt);
    });

    it('rejects an unknown table', async () => {
      await expect(
        service.close('00000000-0000-7000-8000-000000000000'),
      ).rejects.toThrow(TableNotFoundError);
    });
  });
});
