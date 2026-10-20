import 'server-only';

import { HttpStatusCode, isAxiosError } from 'axios';
import { getAccessToken, signOut } from './auth';

/** Why the game server refused a call on the user's behalf. */
export type Refusal = 'unauthorized' | 'forbidden';

export type OnBehalfResult<T> =
  { success: true; data: T } | { success: false; error: Refusal };

/**
 * Calls the game server on behalf of the current user. The game server
 * decides about access: its 401 ends the session, as the token in it is no
 * longer valid, and its 403 is reported. Anything else it fails with is
 * unexpected and thrown.
 */
export async function callOnBehalf<T>(
  call: (accessToken: string) => Promise<T>,
): Promise<OnBehalfResult<T>> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { success: false, error: 'unauthorized' };
  }

  try {
    return { success: true, data: await call(accessToken) };
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.Unauthorized) {
      await signOut({ redirect: false });

      return { success: false, error: 'unauthorized' };
    }

    if (status === HttpStatusCode.Forbidden) {
      return { success: false, error: 'forbidden' };
    }

    throw error;
  }
}

/** Answers a browser's request with what `call` gets from the game server. */
export async function respondOnBehalf(
  call: (accessToken: string) => Promise<unknown>,
): Promise<Response> {
  const result = await callOnBehalf(call);

  if (result.success) {
    return Response.json(result.data);
  }

  return new Response(null, {
    status:
      result.error === 'unauthorized'
        ? HttpStatusCode.Unauthorized
        : HttpStatusCode.Forbidden,
  });
}
