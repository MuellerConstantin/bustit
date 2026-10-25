import { runBot } from './bot.js';
import { readBotAccount } from './env-file.js';
import { parseOptions } from './options.js';

const options = parseOptions(process.argv.slice(2));
const accounts = await Promise.all(
  options.env.map((path) => readBotAccount(path)),
);

await Promise.all(accounts.map((account) => runBot(account, options)));
