import { AuthTokenService } from '../../src/auth/index.js';
import type { User } from '../../src/users/index.js';
import type { TestApp } from './test-app.js';

/**
 * An `Authorization` header value for the user, issued like at login, so
 * tests of other routes don't have to log in over HTTP first.
 */
export async function authorizationFor(
  app: TestApp,
  user: Pick<User, 'id' | 'tokenVersion'>,
): Promise<string> {
  const { token } = await app.get(AuthTokenService).createToken(user);
  return `Bearer ${token}`;
}
