'use server';

import { z } from 'zod';
import { deleteUser } from '@/lib/server/api';
import { callOnBehalf, type Refusal } from '@/lib/server/bff';

export type DeleteUserResult =
  { success: true } | { error: Refusal | 'invalid' | 'notFound' | 'self' };

/** Deletes a user, who can't log in anymore and is no longer listed. */
export async function deleteUserAction(id: string): Promise<DeleteUserResult> {
  const parsed = z.uuid().safeParse(id);

  if (!parsed.success) {
    return { error: 'invalid' };
  }

  const result = await callOnBehalf((accessToken) =>
    deleteUser(accessToken, parsed.data),
  );

  if (!result.success) {
    return { error: result.error };
  }

  return result.data === 'deleted' ? { success: true } : { error: result.data };
}
