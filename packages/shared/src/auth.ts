import { z } from 'zod';
import { ownUserSchema } from './users.js';

/*
 * The rules are exported on their own as well, so forms can apply them with
 * messages of their own.
 */

/** Matched against the username after trimming and lowercasing it. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/*
 * Length is the only password rule, as complexity rules don't make passwords
 * safer. The upper bound keeps hashing a request cheap.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

/**
 * Usernames are compared case-insensitively, so they are stored in lower case.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    'Use 3 to 20 characters: letters, digits and underscores',
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH);

/**
 * Login only normalizes the username instead of validating it, so a wrong one
 * fails like any other wrong credentials.
 */
export const loginRequestSchema = z.object({
  username: z.string().trim().toLowerCase().max(256),
  password: z.string().max(256),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  /** Sent as `Authorization: Bearer <accessToken>` with every request. */
  accessToken: z.string(),
  /** ISO 8601; the token has to be replaced by logging in again by then. */
  expiresAt: z.iso.datetime(),
  user: ownUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * The invite code is only bounded here; its format is checked when it is
 * redeemed, so a mistyped code fails like an unknown one.
 */
export const registerRequestSchema = z.object({
  inviteCode: z.string().trim().min(1).max(64),
  username: usernameSchema,
  password: passwordSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
