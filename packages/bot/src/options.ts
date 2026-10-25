import { parseArgs } from 'node:util';
import { z } from 'zod';

/** What the bot process is started with, see the package's README. */
export type BotOptions = {
  readonly server: string;
  readonly table: string;
  /** One `.env` file per bot, each holding that bot's account. */
  readonly env: readonly string[];
};

const optionsSchema = z.object({
  server: z.url(),
  table: z.uuid(),
  env: z.array(z.string().min(1)).min(1),
});

/**
 * Reads the command line arguments. Without `--env` there is no account to
 * play with, so at least one is required.
 *
 * @throws ZodError if an argument is missing or malformed.
 */
export function parseOptions(args: readonly string[]): BotOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      server: { type: 'string', default: 'http://localhost:8080' },
      table: { type: 'string' },
      env: { type: 'string', multiple: true },
    },
    strict: true,
  });

  return optionsSchema.parse(values);
}
