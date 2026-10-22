import { createHash, randomBytes } from 'node:crypto';

/**
 * Generates a cryptographically secure, URL-safe authentication ticket.
 * The 32 random bytes provide 256 bits of entropy.
 */
export function generateAuthTicket(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes a ticket for storage.
 *
 * Tickets have sufficient entropy to make a plain SHA-256 hash safe
 * against practical brute-force attacks.
 */
export function hashAuthTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}
