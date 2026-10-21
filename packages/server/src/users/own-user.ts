import type { OwnUser } from '@bustit/shared';
import type { User } from './users.schema.js';

/** What a user may see of their own account, nothing like the password hash. */
export function toOwnUser(user: User): OwnUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    balance: user.balance,
  };
}
