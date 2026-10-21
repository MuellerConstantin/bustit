import {
  type InviteStatus,
  type ListInvitesQuery,
  inviteStatusSchema,
} from '@bustit/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle } from '@nestjs/drizzle';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  isNull,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Env } from '../infrastructure/config/index.js';
import {
  type FilterFields,
  whereOf,
} from '../infrastructure/filtering/index.js';
import type {
  Database,
  Transaction,
} from '../infrastructure/database/index.js';
import { generateInviteCode, hashInviteCode } from './invite-code.js';
import {
  InvalidInviteError,
  InviteNotFoundError,
  InviteUsedError,
} from './invites.errors.js';
import { users } from '../users/index.js';
import { type Invite, invites } from './invites.schema.js';

/*
 * The users table joined twice, once per role. Declared once, so the filter
 * fields refer to the same aliases the queries join.
 */
const creator = alias(users, 'creator');
const invitee = alias(users, 'invitee');

export type CreatedInvite = {
  readonly invite: Invite;
  /** The plain code, only available right after creating the invite. */
  readonly code: string;
};

/** An invite as it is listed, with its status and the users' names. */
export type ListedInvite = Invite & {
  readonly status: InviteStatus;
  readonly createdByUsername: string;
  readonly usedByUsername: string | null;
};

/*
 * Derived in the database, so "expired" is judged by the same clock as in
 * claim. A used invite stays used once it expires.
 */
const status = sql<InviteStatus>`case
  when ${invites.usedAt} is not null then 'used'
  when ${invites.revokedAt} is not null then 'revoked'
  when ${invites.expiresAt} <= now() then 'expired'
  else 'open'
end`;

/** What the invites can be filtered on. */
const filterFields = {
  status: {
    expression: status,
    operators: ['==', '!=', '=in=', '=out='],
    value: inviteStatusSchema,
  },
  title: {
    expression: invites.title,
    operators: ['=like='],
    value: z.string(),
  },
  'createdBy.username': {
    expression: creator.username,
    operators: ['==', '=like='],
    value: z.string(),
  },
  'usedBy.username': {
    expression: invitee.username,
    operators: ['==', '=like='],
    value: z.string(),
  },
} satisfies FilterFields;

@Injectable()
export class InvitesService {
  private readonly validityDays: number;

  constructor(
    @InjectDrizzle() private readonly db: Database,
    configService: ConfigService<Env, true>,
  ) {
    this.validityDays = configService.get('INVITE_VALIDITY_DAYS', {
      infer: true,
    });
  }

  /** @param title A title validated with `inviteTitleSchema`. */
  async create(createdBy: string, title: string): Promise<CreatedInvite> {
    const code = generateInviteCode();
    const [invite] = await this.db
      .insert(invites)
      .values({
        codeHash: hashInviteCode(code),
        title,
        createdBy,
        expiresAt: sql`now() + make_interval(days => ${this.validityDays})`,
      })
      .returning();

    return { invite: invite!, code };
  }

  /**
   * One page of the invites, newest first, and how many there are in all.
   * Both are narrowed by the filter if one is given.
   *
   * @throws InvalidFilterError if the filter isn't valid or asks for more
   *   than `filterFields` allows.
   */
  async list({ filter, page, perPage }: ListInvitesQuery): Promise<{
    invites: ListedInvite[];
    totalElements: number;
  }> {
    const where = whereOf(filter, filterFields);

    const [listed, [total]] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(invites),
          status,
          createdByUsername: creator.username,
          usedByUsername: invitee.username,
        })
        .from(invites)
        .innerJoin(creator, eq(invites.createdBy, creator.id))
        .leftJoin(invitee, eq(invites.usedBy, invitee.id))
        .where(where)
        .orderBy(desc(invites.createdAt), desc(invites.id))
        .limit(perPage)
        .offset(page * perPage),
      // Joined like the page, as the filter may refer to the users.
      this.db
        .select({ value: count() })
        .from(invites)
        .innerJoin(creator, eq(invites.createdBy, creator.id))
        .leftJoin(invitee, eq(invites.usedBy, invitee.id))
        .where(where),
    ]);

    return { invites: listed, totalElements: total!.value };
  }

  /**
   * Makes an invite unusable. Revoking it again keeps the first revocation.
   *
   * @throws InviteNotFoundError if there is no invite with the id.
   * @throws InviteUsedError if the invite was used already.
   */
  async revoke(id: string): Promise<void> {
    /*
     * A concurrent claim holds the row lock, so this update waits for it and
     * then finds the invite used.
     */
    const [revoked] = await this.db
      .update(invites)
      .set({ revokedAt: sql`coalesce(${invites.revokedAt}, now())` })
      .where(and(eq(invites.id, id), isNull(invites.usedAt)))
      .returning({ id: invites.id });

    if (revoked) {
      return;
    }

    const [invite] = await this.db
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.id, id));

    throw invite ? new InviteUsedError(id) : new InviteNotFoundError(id);
  }

  /**
   * Finds the open invite for a code as typed by a user and locks it until
   * `tx` ends, so the caller can use it up with `markUsed` in the same
   * transaction. Concurrent claims of one code wait for each other; once the
   * first commits, Postgres checks the conditions again for the waiting
   * ones, which then find the invite used. The same applies to a concurrent
   * revocation.
   *
   * @throws InvalidInviteError if the code is unknown, used, revoked or
   *   expired.
   */
  async claim(code: string, tx: Transaction): Promise<Pick<Invite, 'id'>> {
    const [invite] = await tx
      .select({ id: invites.id })
      .from(invites)
      .where(
        and(
          eq(invites.codeHash, hashInviteCode(code)),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, sql`now()`),
        ),
      )
      .for('update');

    if (!invite) {
      throw new InvalidInviteError();
    }

    return invite;
  }

  /** Uses up an invite claimed in the same transaction. */
  async markUsed(
    inviteId: string,
    usedBy: string,
    tx: Transaction,
  ): Promise<void> {
    await tx
      .update(invites)
      .set({ usedAt: sql`now()`, usedBy })
      .where(eq(invites.id, inviteId));
  }
}
