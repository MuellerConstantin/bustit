<p align="center">
  <img width="120" alt="Logo" src="../web/public/images/logo.svg">
  <h1 align="center">@bustit/server</h1>
</p>
<p align="center">
  The authoritative game server of bustit.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

## Table of Contents

- [Introduction](#introduction)
  - [Features](#features)
- [Configuration](#configuration)
- [Development](#development)

## Introduction

The game server is the casino of bustit. It holds the accounts, the balances and the tables, and it
decides every outcome: clients only send what a player wants to do. The blackjack rules themselves
come from [`@bustit/engine`](../engine).

Its HTTP API is stateless. Login returns a signed token, which clients send as
`Authorization: Bearer <token>` with every request, and every route requires one unless it is
public. Browsers don't call the API directly but go through the web app.

### Features

- Accounts with username and password, registration with an invite code
- Login with bearer tokens that are checked against the database on every request, so disabling a
  user or ending their logins takes effect at once
- A ledger of bookings as the only way to change a balance, safe against concurrent bookings
- Invite codes that are stored hashed and work exactly once
- An operations console for admins under `/api/boc`, e.g. to manage invites
- Structured logs with a request id per HTTP request

## Configuration

The server is configured through environment variables, which are documented in
[`docs/configuration.md`](./docs/configuration.md).

## Development

Starts the server with hot reload. It needs a migrated database; `npm run dev` in the repository
root starts both.

```bash
npm run dev -w @bustit/server
```

Generates a migration after a schema change, and applies the migrations.

```bash
npm run db:generate -w @bustit/server
npm run db:migrate -w @bustit/server
```

Seeds an empty, migrated development database. `npm run services:reset` in the repository root runs it
after the migrations.

```bash
npm run db:seed -w @bustit/server
```

Runs the unit tests, and the e2e tests against a throwaway Postgres in Docker.

```bash
npm run test -w @bustit/server
npm run test:e2e -w @bustit/server
```
