# Configuration

The bot takes its settings from command line arguments and from a `.env` file of its own account.
One process plays one account, so start one process per bot.

## Arguments

| Argument   | Required | Default                 | Meaning                                      |
| ---------- | -------- | ----------------------- | -------------------------------------------- |
| `--table`  | yes      |                         | Id of the open table the bot sits down at    |
| `--env`    | yes      |                         | Path to the `.env` file of the bot's account |
| `--server` | no       | `http://localhost:8080` | URL of the game server                       |

## Account files

The `.env` file holds the account of one bot:

```bash
BOT_USERNAME=bot1
BOT_PASSWORD=<password>
```

Copy `.env.example` to a file such as `.env.bot1.local` in `packages/bot`. Files named `.env*.local`
are not committed. The accounts have to exist already, e.g. created through an invite. The bot never
creates accounts itself.

## Stopping

A bot leaves the table when its balance is too low for the table minimum, which ends its connection.
It also leaves when it can't sit down for a reason other than a seat taken by someone else, e.g. when
the account is seated at another table.
