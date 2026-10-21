import { type SQL, sql } from 'drizzle-orm';
import { PgDialect, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type FilterFields,
  InvalidFilterError,
  whereOf,
} from '../../../src/infrastructure/filtering/index.js';

const items = pgTable('items', {
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
});

const fields = {
  name: {
    expression: items.name,
    operators: ['==', '!=', '=in=', '=out=', '=like='],
    value: z.string().max(20),
  },
  createdAt: {
    expression: items.createdAt,
    operators: ['<', '>='],
    value: z.iso.datetime().transform((value) => new Date(value)),
  },
  size: {
    expression: sql`length(${items.name})`,
    operators: ['==', '>'],
    value: z.coerce.number().int(),
  },
} satisfies FilterFields;

const dialect = new PgDialect();

function render(filter: string) {
  return dialect.sqlToQuery(whereOf(filter, fields) as SQL);
}

describe('whereOf', () => {
  it('has no condition without a filter', () => {
    expect(whereOf(undefined, fields)).toBeUndefined();
  });

  it.each([
    ['name==a', '"items"."name" = $1'],
    ['name!=a', '"items"."name" <> $1'],
    ['size==3', 'length("items"."name") = $1'],
    ['size>3', 'length("items"."name") > $1'],
  ])('compares %s', (filter, expected) => {
    expect(render(filter).sql).toBe(expected);
  });

  it('accepts verbose operators', () => {
    expect(render('createdAt=ge=2026-01-01T00:00:00Z')).toEqual(
      render('createdAt>=2026-01-01T00:00:00Z'),
    );
  });

  it('binds the values the schema parsed, mapped by the column', () => {
    expect(render('size==3').params).toEqual([3]);
    expect(render('createdAt<2026-01-01T00:00:00Z').params).toEqual([
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  it('compares with a list of values', () => {
    expect(render('name=in=(a,b)')).toMatchObject({
      sql: '"items"."name" in ($1, $2)',
      params: ['a', 'b'],
    });
    expect(render('name=out=(a,b)').sql).toBe('"items"."name" not in ($1, $2)');
  });

  it('accepts a single value for a list', () => {
    expect(render('name=in=a')).toMatchObject({
      sql: '"items"."name" in ($1)',
      params: ['a'],
    });
  });

  it('combines comparisons, and before or', () => {
    expect(render('name==a;size==1,size==2').sql).toBe(
      '(("items"."name" = $1 and length("items"."name") = $2) or length("items"."name") = $3)',
    );
    expect(render('name==a;(size==1,size==2)').sql).toBe(
      '("items"."name" = $1 and (length("items"."name") = $2 or length("items"."name") = $3))',
    );
    expect(render('name==a and size==1').sql).toBe(
      '("items"."name" = $1 and length("items"."name") = $2)',
    );
  });

  it('matches like case-insensitively with * as the only wildcard', () => {
    expect(render('name=like="*50%_off\\\\*"')).toMatchObject({
      sql: '"items"."name" ilike $1',
      params: ['%50\\%\\_off\\\\%'],
    });
  });

  it.each([
    ['invalid syntax', 'name=='],
    ['an unknown field', 'secret==a'],
    ['an inherited property as a field', 'constructor==a'],
    ['an operator the field does not allow', 'createdAt==2026-01-01T00:00:00Z'],
    ['an unknown operator', 'name=foo=a'],
    ['a list for a single value', 'name==(a,b)'],
    ['a value the schema rejects', 'size==big'],
    ['one invalid value in a list', 'name=in=(a,bbbbbbbbbbbbbbbbbbbbbbbbb)'],
    ['an invalid field in a combination', 'name==a;secret==b'],
  ])('rejects %s', (_, filter) => {
    expect(() => whereOf(filter, fields)).toThrow(InvalidFilterError);
  });
});
