import { runBot } from './bot.js';
import { readBotAccount } from './env-file.js';
import { parseOptions } from './options.js';

const options = parseOptions(process.argv.slice(2));
const account = await readBotAccount(options.env);

await runBot(account, options);
