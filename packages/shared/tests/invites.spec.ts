import { describe, expect, it } from 'vitest';
import { INVITE_TITLE_MAX_LENGTH, inviteTitleSchema } from '../src/invites.js';

describe('inviteTitleSchema', () => {
  it('trims the title', () => {
    expect(inviteTitleSchema.parse('  Max from the card club ')).toBe(
      'Max from the card club',
    );
  });

  it('accepts up to the maximum length', () => {
    const title = 'a'.repeat(INVITE_TITLE_MAX_LENGTH);

    expect(inviteTitleSchema.safeParse(title).success).toBe(true);
  });

  it.each(['', '   ', 'a'.repeat(INVITE_TITLE_MAX_LENGTH + 1)])(
    'rejects %j',
    (title) => {
      expect(inviteTitleSchema.safeParse(title).success).toBe(false);
    },
  );
});
