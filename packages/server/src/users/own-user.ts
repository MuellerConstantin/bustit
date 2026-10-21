import type { UserProfile } from '@bustit/shared';
import type { User } from './users.schema.js';

/** What a user may see of their own account, nothing like the password hash. */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    balance: user.balance,
  };
}
