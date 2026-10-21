'use server';

import {
  type LoginRequest,
  type RegisterRequest,
  registerRequestSchema,
} from '@bustit/shared';
import { AuthError } from 'next-auth';
import { register } from '@/lib/server/api';
import { signIn, signOut } from '@/lib/server/auth';

export type LoginResult = { success: true } | { error: 'invalidCredentials' };

/**
 * Starts a session. The input is checked by `authorize`, which every sign-in
 * goes through. Failures other than wrong credentials are thrown, so they get
 * logged instead of being passed off as a wrong password.
 */
export async function loginAction(data: LoginRequest): Promise<LoginResult> {
  try {
    await signIn('credentials', { ...data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError && error.type === 'CredentialsSignin') {
      return { error: 'invalidCredentials' };
    }

    throw error;
  }

  return { success: true };
}

export type RegisterResult =
  { success: true } | { error: 'invalid' | 'invalidInvite' | 'usernameTaken' };

/**
 * Creates a player account with an invite code and starts a session for it.
 * A sign-in failing right after registering is unexpected, so it is thrown.
 */
export async function registerAction(
  data: RegisterRequest,
): Promise<RegisterResult> {
  const parsed = registerRequestSchema.safeParse(data);

  if (!parsed.success) {
    return { error: 'invalid' };
  }

  const outcome = await register(parsed.data);

  if (outcome !== 'registered') {
    return { error: outcome };
  }

  const { username, password } = parsed.data;
  await signIn('credentials', { username, password, redirect: false });

  return { success: true };
}

/** Ends the session; the caller navigates to the login afterwards. */
export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
}
