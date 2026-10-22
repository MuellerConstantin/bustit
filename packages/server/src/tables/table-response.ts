import type { BocTable, Table as TableResponse } from '@bustit/shared';
import type { Table } from './tables.schema.js';
import type { ListedTable } from './tables.service.js';

/** What players need to pick a table. */
export function toTableResponse(table: Table): TableResponse {
  return {
    id: table.id,
    name: table.name,
    seats: table.seats,
    minBet: table.minBet,
    maxBet: table.maxBet,
  };
}

export function toBocTable(table: ListedTable): BocTable {
  return {
    ...toTableResponse(table),
    status: table.status,
    createdAt: table.createdAt.toISOString(),
    closedAt: table.closedAt?.toISOString() ?? null,
  };
}
