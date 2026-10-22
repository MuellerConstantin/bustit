'use server';

import {
  type CreateTableRequest,
  createTableRequestSchema,
} from '@bustit/shared';
import { z } from 'zod';
import { closeTable, createTable } from '@/lib/server/api';
import { callOnBehalf, type Refusal } from '@/lib/server/bff';

export type CreateTableResult =
  { success: true } | { error: Refusal | 'invalid' | 'nameTaken' };

/** Creates an open table that players can sit down at. */
export async function createTableAction(
  data: CreateTableRequest,
): Promise<CreateTableResult> {
  const parsed = createTableRequestSchema.safeParse(data);

  if (!parsed.success) {
    return { error: 'invalid' };
  }

  const result = await callOnBehalf((accessToken) =>
    createTable(accessToken, parsed.data),
  );

  if (!result.success) {
    return { error: result.error };
  }

  return result.data.created
    ? { success: true }
    : { error: result.data.reason };
}

export type CloseTableResult =
  { success: true } | { error: Refusal | 'invalid' | 'notFound' };

/** Closes a table, so players can no longer sit down at it. */
export async function closeTableAction(id: string): Promise<CloseTableResult> {
  const parsed = z.uuid().safeParse(id);

  if (!parsed.success) {
    return { error: 'invalid' };
  }

  const result = await callOnBehalf((accessToken) =>
    closeTable(accessToken, parsed.data),
  );

  if (!result.success) {
    return { error: result.error };
  }

  return result.data === 'closed' ? { success: true } : { error: result.data };
}
