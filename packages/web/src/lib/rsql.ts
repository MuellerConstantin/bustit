/**
 * Quotes a value for an RSQL filter, so spaces and RSQL's own characters,
 * such as `;` or `,`, stay part of the value.
 */
function quote(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

/**
 * Matches what contains `text` in any of `fields`, ignoring case. A `*` in
 * `text` still matches anything, as `=like=` reads it as its wildcard.
 */
export function containsFilter(
  fields: readonly string[],
  text: string,
): string {
  const pattern = quote(`*${text}*`);

  return `(${fields.map((field) => `${field}=like=${pattern}`).join(',')})`;
}

/** Combines filters with AND, leaving out those that aren't given. */
export function allOf(...filters: (string | undefined)[]): string | undefined {
  const given = filters.filter((filter) => filter !== undefined);

  return given.length > 0 ? given.join(';') : undefined;
}
