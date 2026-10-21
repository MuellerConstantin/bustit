<p align="center">
  <img width="120" alt="Logo" src="./packages/web/public/images/logo.svg">
  <h1 align="center">bustit</h1>
</p>
<p align="center">
  Multiplayer blackjack for closed groups, with play money only.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql" />
  <img src="https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript" />
</p>

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Packages](#packages)
- [Development](#development)
  - [Database](#database)
  - [Checks](#checks)
- [License](#license)
  - [Forbidden](#forbidden)

## Introduction

bustit is a blackjack table in the browser for closed groups. You sit down together at a shared table,
play against the dealer and watch each other's luck, with nothing to install.

- **Closed groups.** There is no open sign-up. You get in with an invite from an admin.
- **Play money, nothing else.** Every player gets a starting balance of Bucks, bustit's play currency.
  Bucks can't be bought, paid out or traded for anything, so all that's at stake is bragging rights.
- **Fair by design.** The server shuffles, deals and settles every hand. Nobody's browser decides
  anything, and nobody sees a card before it is turned over.

bustit is in early development. The features below describe what it is being built to offer; so far,
signing up and logging in exist.

## Features

- Sign up with an invite code and a username and password of your choice; no email needed
- Several public tables; join one to watch, take a free seat to play
- Classic blackjack against the dealer: hit, stand, double down and split, a blackjack pays 3:2
- Backbets: spectators and players can bet on another player's seat and ride along with their hand,
  but never on their own
- A balance in Bucks that every bet, win and loss is booked against, with a starting balance
  for new players
- German and English

## Packages

| Package                               | Description                                                      |
| ------------------------------------- | ---------------------------------------------------------------- |
| [`@bustit/engine`](./packages/engine) | The blackjack rules as pure functions                            |
| [`@bustit/shared`](./packages/shared) | Schemas and types shared between the game server and the web app |
| [`@bustit/server`](./packages/server) | The authoritative game server                                    |
| [`@bustit/web`](./packages/web)       | The browser client                                               |

The game server and the web app document their configuration in their own `docs/configuration.md`.

## Development

Requirements:

- Node.js 24+ and npm 11+
- Docker, for the local database

Installs the dependencies of all packages.

```bash
npm install
```

Sets up the local services from `compose.dev.yaml`, such as the database, applies the migrations and
seeds the database, which `npm run dev` doesn't do.

```bash
npm run services:reset
```

Starts the database from `compose.dev.yaml`, builds the shared libraries and runs the game server and
the web app with hot reload. The web app runs on http://localhost:3000.

```bash
npm run dev
```

The services keep running afterwards and are stopped separately.

```bash
npm run services:stop
```

`services:reset` puts all local services back to their initial state: it removes them with their data,
starts them fresh, applies the migrations again and seeds the database.

```bash
npm run services:reset
```

The seed creates the admin from the environment, the players `alice`, `bob`, `carol`, `dave` and
`erin` with the password `test-password`, and an invite in every status. It prints the code of the
open invite.

### Database

Schema changes go through a generated migration, which is committed and never edited by hand.

```bash
npm run db:generate -w @bustit/server
```

Migrations are applied before the server starts, never by the server itself. `services:reset` wipes the
local database along with the other services, applies them again and seeds it.

```bash
npm run db:migrate -w @bustit/server
npm run services:reset
```

### Checks

Type checking, linting, tests and formatting must pass before a change is done. Commit messages and
other conventions are described in [CONTRIBUTING.md](./CONTRIBUTING.md). The e2e tests run
against a throwaway Postgres in Docker.

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run format
```

## License

Copyright (c) 2026 Constantin Müller and contributors

[GNU AFFERO GENERAL PUBLIC LICENSE](https://www.gnu.org/licenses/) or [LICENSE](./LICENSE.md) for
more details.

### Forbidden

**Hold Liable**: Software is provided without warranty and the software
author/license owner cannot be held liable for damages.
