'use server';

import { createInvite } from '@/lib/server/api';
import { callOnBehalf, type Refusal } from '@/lib/server/bff';

export type CreateInviteResult =
  { success: true; code: string } | { error: Refusal };

/** Creates an invite and hands out its code, which is shown only this once. */
export async function createInviteAction(): Promise<CreateInviteResult> {
  const result = await callOnBehalf(createInvite);

  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, code: result.data.code };
}
