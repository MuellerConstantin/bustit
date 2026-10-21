import 'server-only';

import {
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type RegisterRequest,
} from '@bustit/shared';
import { HttpStatusCode, isAxiosError } from 'axios';
import { api } from './client';

/** Returns `null` for wrong credentials; anything else is unexpected. */
export async function login(body: LoginRequest): Promise<LoginResponse | null> {
  try {
    const { data } = await api.post<unknown>('/auth/login', body);

    return loginResponseSchema.parse(data);
  } catch (error) {
    if (
      isAxiosError(error) &&
      error.response?.status === HttpStatusCode.Unauthorized
    ) {
      return null;
    }

    throw error;
  }
}

/** What registering came to. */
export type RegisterOutcome = 'registered' | 'invalidInvite' | 'usernameTaken';

/**
 * Creates a player account with an invite code. The game server answers with
 * a token as well, which is left unused: the session is started by logging
 * in, which every way into a session goes through.
 *
 * The body has to be valid already: the game server answers invalid input
 * with a 400 as well, which would be taken for an invalid invite.
 */
export async function register(
  body: RegisterRequest,
): Promise<RegisterOutcome> {
  try {
    await api.post('/auth/register', body);

    return 'registered';
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === HttpStatusCode.BadRequest) {
      return 'invalidInvite';
    }

    if (status === HttpStatusCode.Conflict) {
      return 'usernameTaken';
    }

    throw error;
  }
}
