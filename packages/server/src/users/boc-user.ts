import type { BocUser } from '@bustit/shared';
import type { User } from './users.schema.js';

/** Leaves out the password hash and the token version. */
export function toBocUser(user: User): BocUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    balance: user.balance,
    createdAt: user.createdAt.toISOString(),
    disabledAt: user.disabledAt?.toISOString() ?? null,
  };
}
