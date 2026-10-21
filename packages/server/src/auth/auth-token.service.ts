import type { LoginResponse } from '@bustit/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../infrastructure/config/index.js';
import { type User, toOwnUser } from '../users/index.js';

const VALIDITY_DAYS = 30;
const ALGORITHM = 'HS256';

export type AuthToken = {
  readonly token: string;
  readonly expiresAt: Date;
};

export type AuthTokenClaims = {
  readonly userId: string;
  readonly tokenVersion: number;
};

/**
 * A login is a signed token that clients send as bearer token; the server
 * keeps no state about it and sets no cookies, so any client can use it. The
 * token only names the user and the token version. Everything else, such as
 * the role or whether the user is disabled, is read from the database on
 * every request, so changes take effect at once.
 */
@Injectable()
export class AuthTokenService {
  private readonly secret: Uint8Array;

  constructor(configService: ConfigService<Env, true>) {
    this.secret = new TextEncoder().encode(
      configService.get('JWT_SECRET', { infer: true }),
    );
  }

  async createToken(
    user: Pick<User, 'id' | 'tokenVersion'>,
  ): Promise<AuthToken> {
    const expiresAt = new Date(
      Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    );
    const token = await new SignJWT({ tv: user.tokenVersion })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.secret);

    return { token, expiresAt };
  }

  /** What a client gets on login: a fresh token and the user's profile. */
  async loginResponseFor(user: User): Promise<LoginResponse> {
    const { token, expiresAt } = await this.createToken(user);

    return {
      accessToken: token,
      expiresAt: expiresAt.toISOString(),
      user: toOwnUser(user),
    };
  }

  /** Returns `null` for a token that is invalid, expired or malformed. */
  async verifyToken(token: string): Promise<AuthTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ALGORITHM],
      });

      if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') {
        return null;
      }

      return { userId: payload.sub, tokenVersion: payload.tv };
    } catch {
      return null;
    }
  }
}
