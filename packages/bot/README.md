# @bustit/bot

Plays bustit as a client, like a browser does, to try out tables with several players. Each bot
logs in with its own account, sits down, bets the table minimum in every betting window and plays
its turns by basic strategy. The server doesn't know it's a bot.

## Development

Builds the bot to `dist/`, the libraries it uses have to be built first (`npm run build:libs`).

```bash
npm run build -w @bustit/bot
```

Starts one bot at a table, one process per account. The account has to exist already, see
[configuration](docs/configuration.md). npm runs the script in the package folder, so the path to
the `.env` file is relative to `packages/bot`.

```bash
npm run start -w @bustit/bot -- --table <table-id> --env .env.bot1.local
```

Start another process with its own `.env` file for each further bot.

Runs the house edge simulation, which plays millions of hands by basic strategy. It takes a while,
so it isn't part of `test`.

```bash
npm run test:sim -w @bustit/bot
```
