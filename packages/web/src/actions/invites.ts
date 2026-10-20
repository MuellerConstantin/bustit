'use server';

import {
  type CreateInviteRequest,
  createInviteRequestSchema,
} from '@bustit/shared';
import { createInvite } from '@/lib/server/api';
import { callOnBehalf, type Refusal } from '@/lib/server/bff';

export type CreateInviteResult =
  { success: true; code: string } | { error: Refusal | 'invalid' };

/** Creates an invite and hands out its code, which is shown only this once. */
export async function createInviteAction(
  data: CreateInviteRequest,
): Promise<CreateInviteResult> {
  const parsed = createInviteRequestSchema.safeParse(data);

  if (!parsed.success) {
    return { error: 'invalid' };
  }

  const result = await callOnBehalf((accessToken) =>
    createInvite(accessToken, parsed.data),
  );

  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, code: result.data.code };
}
