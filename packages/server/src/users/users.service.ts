import type { PageQuery } from '@bustit/shared';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { count, desc, eq } from 'drizzle-orm';
import {
  type Database,
  type Transaction,
  isUniqueViolation,
} from '../infrastructure/database/index.js';
import { UsernameTakenError } from './users.errors.js';
import { type User, type UserRole, users } from './users.schema.js';

export type NewUser = {
  /** Already normalized, see `usernameSchema` in `@bustit/shared`. */
  readonly username: string;
  readonly passwordHash: string;
  readonly role: UserRole;
};

@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  /** Expects the normalized username, see `usernameSchema`. */
  async findByUsername(username: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
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
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(perPage)
        .offset(page * perPage),
      this.db.select({ value: count() }).from(users),
    ]);

    return { users: listed, totalElements: total!.value };
  }

  async hasAdmin(tx?: Transaction): Promise<boolean> {
    const [admin] = await (tx ?? this.db)
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    return admin !== undefined;
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
