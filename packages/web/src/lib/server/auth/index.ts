import { loginRequestSchema, type OwnUser } from '@bustit/shared';
import NextAuth from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { headers } from 'next/headers';
import Credentials from 'next-auth/providers/credentials';
import { login } from '../api';
import { serverEnv } from '../env';

type Role = OwnUser['role'];

declare module 'next-auth' {
  interface User {
    username: string;
    role: Role;
    /*
     * Only set on the user `authorize` returns, from where the `jwt` callback
     * moves them into the session cookie. They are optional because the
     * session's user, which reaches the browser, must not have them.
     */
    accessToken?: string;
    accessTokenExpiresAt?: string;
  }

  interface Session {
    user: { id: string; username: string; role: Role };
  }
}

// `next-auth/jwt` only re-exports this module, so it can't be augmented.
declare module '@auth/core/jwt' {
  interface JWT {
    sub: string;
    username: string;
    role: Role;
    accessToken: string;
    accessTokenExpiresAt: string;
  }
}

const SESSION_COOKIE = 'bustit.session';

/**
 * The web app's own session. The game server's token is kept in the
 * encrypted, HTTP-only session cookie and never handed to browser code:
 * `session` leaves it out, so `/api/auth/session` doesn't reveal it either.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // The app always runs behind the reverse proxy, which sets the host.
  trustHost: true,
  session: { strategy: 'jwt' },
  // Keeps users away from next-auth's built-in pages.
  pages: { signIn: '/login', error: '/login' },
  cookies: {
    sessionToken: { name: SESSION_COOKIE },
    csrfToken: { name: 'bustit.csrf' },
    callbackUrl: { name: 'bustit.callback-url' },
  },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      /*
       * Every way into a session ends up here, the login action as well as a
       * request to next-auth's endpoint, so this is where input is checked.
       */
      async authorize(credentials) {
        const parsed = loginRequestSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const response = await login(parsed.data);

        if (!response) {
          return null;
        }

        return {
          id: response.user.id,
          username: response.user.username,
          role: response.user.role,
          accessToken: response.accessToken,
          accessTokenExpiresAt: response.expiresAt,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        if (!user.id || !user.accessToken || !user.accessTokenExpiresAt) {
          throw new Error('Signed in without an access token');
        }

        return {
          sub: user.id,
          username: user.username,
          role: user.role,
          accessToken: user.accessToken,
          accessTokenExpiresAt: user.accessTokenExpiresAt,
        };
      }

      // A session can't outlive the token it holds; `null` ends it.
      if (Date.parse(token.accessTokenExpiresAt) <= Date.now()) {
        return null;
      }

      return token;
    },
    session({ session, token }) {
      return {
        expires: session.expires,
        user: { id: token.sub, username: token.username, role: token.role },
      };
    },
  },
});

/**
 * The game server's token from the current request's session cookie, for
 * calls to the game server on the user's behalf. `null` without a session.
 */
export async function getAccessToken(): Promise<string | null> {
  const token = await getToken({
    req: { headers: await headers() },
    secret: serverEnv().AUTH_SECRET,
    cookieName: SESSION_COOKIE,
    salt: SESSION_COOKIE,
  });

  return token?.accessToken ?? null;
}
