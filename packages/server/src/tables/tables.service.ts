import {
  type CreateTableRequest,
  type ListTablesQuery,
  type TableStatus,
  tableStatusSchema,
} from '@bustit/shared';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  isNull,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import {
  type FilterFields,
  whereOf,
} from '../infrastructure/filtering/index.js';
import {
  type Database,
  isUniqueViolation,
} from '../infrastructure/database/index.js';
import { TableNameTakenError, TableNotFoundError } from './tables.errors.js';
import { type Table, tables } from './tables.schema.js';

/** A table as it is listed, with its status. */
export type ListedTable = Table & { readonly status: TableStatus };

const status = sql<TableStatus>`case
  when ${tables.closedAt} is not null then 'closed'
  else 'open'
end`;

/** What the tables can be filtered on. */
const filterFields = {
  status: {
    expression: status,
    operators: ['==', '!=', '=in=', '=out='],
    value: tableStatusSchema,
  },
  name: {
    expression: tables.name,
    operators: ['==', '=like='],
    value: z.string(),
  },
} satisfies FilterFields;

@Injectable()
export class TablesService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  /**
   * @param table Validated with `createTableRequestSchema`.
   * @throws TableNameTakenError if another table, closed ones included, has
   *   the name.
   */
  async create(table: CreateTableRequest): Promise<Table> {
    try {
      const [created] = await this.db.insert(tables).values(table).returning();
      return created!;
    } catch (error) {
      if (isUniqueViolation(error, 'tables_name_unique')) {
        throw new TableNameTakenError(table.name);
      }

      throw error;
    }
  }

  /**
   * One page of the tables, newest first, and how many there are in all.
   * Both are narrowed by the filter if one is given, and to the open tables
   * if `openOnly` is set, whatever the filter asks for.
   *
   * @throws InvalidFilterError if the filter isn't valid or asks for more
   *   than `filterFields` allows.
   */
  async list(
    { filter, page, perPage }: ListTablesQuery,
    { openOnly = false }: { openOnly?: boolean } = {},
  ): Promise<{
    tables: ListedTable[];
    totalElements: number;
  }> {
    const where = and(
      openOnly ? isNull(tables.closedAt) : undefined,
      whereOf(filter, filterFields),
    );

    const [listed, [total]] = await Promise.all([
      this.db
        .select({ ...getTableColumns(tables), status })
        .from(tables)
        .where(where)
        .orderBy(desc(tables.createdAt), desc(tables.id))
        .limit(perPage)
        .offset(page * perPage),
      this.db.select({ value: count() }).from(tables).where(where),
    ]);

    return { tables: listed, totalElements: total!.value };
  }

  /**
   * Closes a table for good. Closing it again keeps the first closing.
   *
   * @throws TableNotFoundError if there is no table with the id.
   */
  async close(id: string): Promise<void> {
    const [closed] = await this.db
      .update(tables)
      .set({ closedAt: sql`coalesce(${tables.closedAt}, now())` })
      .where(eq(tables.id, id))
      .returning({ id: tables.id });

    if (!closed) {
      throw new TableNotFoundError(id);
    }
  }
}
