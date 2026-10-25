import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/** The account a bot plays with. */
export type BotAccount = {
  readonly username: string;
  readonly password: string;
};

const botEnvSchema = z.object({
  BOT_USERNAME: z.string().min(1),
  BOT_PASSWORD: z.string().min(1),
});

/**
 * Reads the account of one bot from a `.env` file. The file holds one
 * `KEY=value` per line, and blank lines or `#` comments are skipped.
 *
 * @throws ZodError if the file doesn't set both `BOT_USERNAME` and
 *   `BOT_PASSWORD`.
 */
export async function readBotAccount(path: string): Promise<BotAccount> {
  const values = parseEnv(await readFile(path, 'utf8'));
  const env = botEnvSchema.parse(values);

  return { username: env.BOT_USERNAME, password: env.BOT_PASSWORD };
}

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf('=');

    if (trimmed === '' || trimmed.startsWith('#') || separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    values[key] = unquote(trimmed.slice(separator + 1).trim());
  }

  return values;
}

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);

  return quoted ? quoted[2]! : value;
}
