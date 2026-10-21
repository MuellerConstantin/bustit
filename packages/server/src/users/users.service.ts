import type { PageQuery } from '@bustit/shared';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  type Database,
  type Transaction,
  isUniqueViolation,
} from '../infrastructure/database/index.js';
import {
  SelfDeletionError,
  UserNotFoundError,
  UsernameTakenError,
} from './users.errors.js';
import { type User, type UserRole, users } from './users.schema.js';

export type NewUser = {
  /** Already normalized, see `usernameSchema` in `@bustit/shared`. */
  readonly username: string;
  readonly passwordHash: string;
  readonly role: UserRole;
};

const notDeleted = isNull(users.deletedAt);

/** Deleted users are left out of every lookup and list. */
@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), notDeleted));
    return user ?? null;
  }

  /** Expects the normalized username, see `usernameSchema`. */
  async findByUsername(username: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.username, username), notDeleted));
    return user ?? null;
  }

  /** One page of the users, newest first, and how many there are in all. */
  async list({ page, perPage }: PageQuery): Promise<{
    users: User[];
    totalElements: number;
  }> {
    const [listed, [total]] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(notDeleted)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(perPage)
        .offset(page * perPage),
      this.db.select({ value: count() }).from(users).where(notDeleted),
    ]);

    return { users: listed, totalElements: total!.value };
  }

  async hasAdmin(tx?: Transaction): Promise<boolean> {
    const [admin] = await (tx ?? this.db)
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), notDeleted))
      .limit(1);
    return admin !== undefined;
  }

  /**
   * Marks a user deleted, which ends their logins. The row stays, so their
   * ledger entries and invites keep pointing at it, and so does the username.
   *
   * @throws SelfDeletionError if `deletedBy` is the user.
   * @throws UserNotFoundError if there is no such user or it is deleted.
   */
  async delete(id: string, deletedBy: string): Promise<void> {
    if (id === deletedBy) {
      throw new SelfDeletionError(id);
    }

    const [deleted] = await this.db
      .update(users)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(users.id, id), notDeleted))
      .returning({ id: users.id });

    if (!deleted) {
      throw new UserNotFoundError(id);
    }
  }

  /**
   * Creates a user with a balance of zero, see `AccountService`.
   *
   * @throws UsernameTakenError if another user has the username.
   */
  async create(user: NewUser, tx: Transaction): Promise<User> {
    try {
      const [created] = await tx.insert(users).values(user).returning();
      return created!;
    } catch (error) {
      if (isUniqueViolation(error, 'users_username_unique')) {
        throw new UsernameTakenError(user.username);
      }

      throw error;
    }
  }
}
