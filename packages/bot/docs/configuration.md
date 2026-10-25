# Configuration

The bot takes its settings from command line arguments and from one `.env` file per bot.

## Arguments

| Argument   | Required | Default                 | Meaning                                                   |
| ---------- | -------- | ----------------------- | --------------------------------------------------------- |
| `--table`  | yes      |                         | Id of the open table the bots sit down at                 |
| `--env`    | yes      |                         | Path to a `.env` file of one bot, repeat it for more bots |
| `--server` | no       | `http://localhost:8080` | URL of the game server                                    |

## Account files

Each `.env` file holds the account of one bot:

```bash
BOT_USERNAME=bot1
BOT_PASSWORD=<password>
```

Copy `.env.example` to a file such as `.env.bot1.local` in the repository root. Files named
`.env*.local` are not committed. The accounts have to exist already, e.g. created through an invite.
The bot never creates accounts itself.

`npm run start -w @bustit/bot` runs in `packages/bot`, so a file in the repository root is passed as
`../../.env.bot1.local`.

## Stopping

A bot leaves the table when its balance is too low for the table minimum, which ends its connection.
It also leaves when it can't sit down for a reason other than a seat taken by someone else, e.g. when
the account is seated at another table.
