import 'server-only';

import { HttpStatusCode, isAxiosError } from 'axios';
import { getAccessToken, signOut } from './auth';

/**
 * Answers a browser's request with what `call` gets from the game server on
 * the user's behalf. The game server decides about access: its 401 ends the
 * session, as the token in it is no longer valid, and its 403 is passed on.
 * Anything else it fails with is unexpected and thrown.
 */
export async function respondOnBehalf(
  call: (accessToken: string) => Promise<unknown>,
): Promise<Response> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return new Response(null, { status: HttpStatusCode.Unauthorized });
  }

  try {
    return Response.json(await call(accessToken));
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.Unauthorized) {
      await signOut({ redirect: false });

      return new Response(null, { status });
    }

    if (status === HttpStatusCode.Forbidden) {
      return new Response(null, { status });
    }

    throw error;
  }
}
