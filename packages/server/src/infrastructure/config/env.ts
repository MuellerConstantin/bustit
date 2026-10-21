import { passwordSchema, usernameSchema } from '@bustit/shared';
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),
  LOG_DIR: z.string().min(1).default('./logs'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Bucks booked once to every new account. */
  STARTING_BALANCE: z.coerce.number().int().positive().default(1000),
  /** Days an invite code can be redeemed after it was created. */
  INVITE_VALIDITY_DAYS: z.coerce.number().int().positive().default(7),
  /** Signs auth tokens. At least 32 characters, random in production. */
  JWT_SECRET: z.string().min(32),
  /** Created as admin on startup unless an admin exists already. */
  ADMIN_USERNAME: usernameSchema,
  ADMIN_PASSWORD: passwordSchema,
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used as `validate` hook of the ConfigModule, so a missing or malformed
 * variable stops the boot instead of surfacing later at the first use.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
