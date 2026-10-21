import {
  AND,
  AND_VERBOSE,
  type ComparisonNode,
  type ExpressionNode,
  getSelector,
  getValue,
  isLogicNode,
} from '@rsql/ast';
import { parse } from '@rsql/parser';
import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  notInArray,
  or,
  type SQL,
  type AnyColumn,
} from 'drizzle-orm';
import type { z } from 'zod';
import { InvalidFilterError } from './filter.errors.js';

/**
 * The comparisons a filter field can allow. `=like=` matches case-insensitively
 * with `*` as the wildcard.
 */
export type FilterOperator =
  '==' | '!=' | '<' | '<=' | '>' | '>=' | '=in=' | '=out=' | '=like=';

/** A field clients may filter a list on. */
export type FilterField = {
  /** The column or SQL expression the field compares. */
  readonly expression: AnyColumn | SQL;
  readonly operators: readonly FilterOperator[];
  /**
   * Parses each value as sent. Its output is bound to the expression, so it
   * has to be what the column expects, e.g. a `Date` for a timestamp.
   * `=like=` needs a string.
   */
  readonly value: z.ZodType;
};

/** What a list can be filtered on, keyed by the name used in the filter. */
export type FilterFields = Readonly<Record<string, FilterField>>;

const VERBOSE_OPERATORS: Readonly<Record<string, FilterOperator>> = {
  '=lt=': '<',
  '=le=': '<=',
  '=gt=': '>',
  '=ge=': '>=',
};

const LIST_OPERATORS: readonly FilterOperator[] = ['=in=', '=out='];

/**
 * Turns an RSQL filter into a condition for `where`. Only the fields, the
 * operators and the values `fields` declares are accepted. `!=` and `=out=`
 * compare like SQL, so they don't match rows where the expression is null.
 *
 * @returns `undefined` without a filter, which `where` reads as no condition.
 * @throws InvalidFilterError if the filter isn't valid RSQL or uses
 *   anything `fields` doesn't allow.
 */
export function whereOf(
  filter: string | undefined,
  fields: FilterFields,
): SQL | undefined {
  if (filter === undefined) {
    return undefined;
  }

  let root: ExpressionNode;
  try {
    root = parse(filter);
  } catch (error) {
    throw new InvalidFilterError('The filter is not valid RSQL', {
      cause: error,
    });
  }

  return toCondition(root, fields);
}

function toCondition(node: ExpressionNode, fields: FilterFields): SQL {
  if (!isLogicNode(node)) {
    return toComparison(node, fields);
  }

  const left = toCondition(node.left, fields);
  const right = toCondition(node.right, fields);
  const combined =
    node.operator === AND || node.operator === AND_VERBOSE
      ? and(left, right)
      : or(left, right);

  // Both sides are conditions, so the combination is never empty.
  return combined!;
}

function toComparison(node: ComparisonNode, fields: FilterFields): SQL {
  const name = getSelector(node);
  const operator = VERBOSE_OPERATORS[node.operator] ?? node.operator;

  /*
   * Object.hasOwn keeps names such as `constructor` from resolving to what
   * every object inherits.
   */
  const field = Object.hasOwn(fields, name) ? fields[name] : undefined;
  if (!field) {
    throw new InvalidFilterError(`Can't filter on ${name}`);
  }

  if (!field.operators.includes(operator as FilterOperator)) {
    throw new InvalidFilterError(`Can't filter ${name} with ${operator}`);
  }

  const raw = getValue(node);
  const isList = LIST_OPERATORS.includes(operator as FilterOperator);
  if (Array.isArray(raw) && !isList) {
    throw new InvalidFilterError(`${operator} takes a single value`);
  }

  const values = (Array.isArray(raw) ? raw : [raw]).map((value) => {
    const result = field.value.safeParse(value);
    if (!result.success) {
      throw new InvalidFilterError(`Invalid value for ${name}: ${value}`);
    }

    return result.data;
  });

  return compare(field.expression, operator as FilterOperator, values);
}

function compare(
  expression: AnyColumn | SQL,
  operator: FilterOperator,
  values: readonly unknown[],
): SQL {
  const [value] = values;
  /*
   * The operators take columns and SQL alike, but their overloads don't
   * accept the union. A column still binds the value through its own
   * mapping at runtime, e.g. a `Date` for a timestamp.
   */
  const left = expression as SQL;

  switch (operator) {
    case '==':
      return eq(left, value);
    case '!=':
      return ne(left, value);
    case '<':
      return lt(left, value);
    case '<=':
      return lte(left, value);
    case '>':
      return gt(left, value);
    case '>=':
      return gte(left, value);
    case '=in=':
      return inArray(left, [...values]);
    case '=out=':
      return notInArray(left, [...values]);
    case '=like=':
      return ilike(left, likePattern(value));
  }
}

/** Escapes LIKE's own wildcards, so only `*` matches anything. */
function likePattern(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('=like= needs a field whose value is a string');
  }

  return value.replace(/[\\%_]/g, '\\$&').replaceAll('*', '%');
}
