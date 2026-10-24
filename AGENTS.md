# Project Overview

**bustit** is a browser-based multiplayer blackjack game played with play
money. What it offers and how it works for its users is described in the
[README](README.md) and the docs it links to; this file doesn't repeat it.
Read them before working on a feature. This file is about how the code is
built: structure, conventions and the decisions behind them.

**Before writing a commit message, read [CONTRIBUTING.md](CONTRIBUTING.md)
and follow its commit convention exactly.** It also lists the language rules
and the checks a change has to pass. This file doesn't repeat them.

## Product Constraints

- **Play money only**: The balance has no real-world value. Never add
  anything that would give it one, such as buying Bucks, paying them out or
  trading them for prizes. If a feature seems to need that, raise it instead
  of building it.

## Tech Stack

- **Runtime**: Node.js 24+, TypeScript 6
- **Monorepo**: npm workspaces
- **Server**: NestJS 12 (ESM) with Express, winston via `nest-winston`
- **Web**: Next.js 16 (App Router) with React 19, Tailwind CSS v4, React Aria
  Components with `tailwindcss-react-aria-components`, `tailwind-variants`,
  Formik with Zod, `next-intl` (German and English), Lucide icons,
  next-auth v5 for sessions, axios for calls to the game server
- **Database**: PostgreSQL 18, Drizzle ORM 0.45 with `node-postgres` via
  `@nestjs/drizzle`, `drizzle-kit` for migrations
- **Auth**: Stateless bearer tokens signed with `jose`, passwords hashed with
  argon2id (`argon2`)
- **Validation**: Zod
- **Testing**: Vitest, Supertest, Testcontainers (Postgres)
- **Tooling**: ESLint 9 (flat config per package), Prettier (repository root)
- **Component-Development**: Storybook 10+ for component development

## Project Structure

```
.
├── packages/
│   ├── engine/         # @bustit/engine: blackjack rules as pure functions
│   ├── shared/         # @bustit/shared: Zod schemas and types for server and web
│   ├── server/         # @bustit/server: NestJS game server
│   │   ├── src/        # One folder per feature, technical concerns in infrastructure/
│   │   ├── drizzle/    # Generated migrations, committed
│   │   ├── seed/       # Factories for tests and seed, the development seed
│   │   └── tests/      # Unit and e2e tests mirroring src/, shared helpers in utils/
│   └── web/            # @bustit/web: Next.js client, UI only
│       ├── src/
│       │   ├── actions/        # Server Actions: changes the browser asks for
│       │   ├── app/[locale]/   # Pages, one route tree per locale
│       │   ├── app/api/        # The web app's own endpoints: next-auth's and data the browser loads
│       │   ├── components/     # Atomic Design: atoms, molecules, organisms, templates
│       │   ├── hooks/          # React hooks, e.g. SWR hooks for the data endpoints
│       │   ├── i18n/           # Locales, routing, typed messages, locale-aware navigation
│       │   └── lib/            # Helpers; server/ and client/ hold code for one side only
│       └── messages/           # Translations, one JSON file per locale
├── tsconfig.base.json  # Shared compiler options for engine, shared and server
└── package.json        # Workspace scripts
```

The tree shows where things belong, not everything that exists. Look at the
folders themselves for that.

## Design Decisions

### Game Engine

- **Server is authoritative**: The server owns the deck, shuffle, rules and
  every balance change. Clients only send actions and never decide outcomes.
- **Game rules in `@bustit/engine`**: Blackjack logic is a set of pure
  functions with an injectable RNG, free of NestJS, I/O and timers. This keeps
  the rules deterministic and testable.
- **The engine is the dealer, the server is the casino**: The engine deals,
  plays the dealer and settles hands. It knows stakes per hand, because
  doubles and splits change them, but not whose money they are. A seat is just
  an index. Users, seating, spectators, balances, the ledger, betting, timers,
  backbets and side bets belong to the server.
- **Backbets settle outside the engine**: A backbet has no influence on the
  game. The server settles it with the engine's payout rule, the outcome of
  the seat's first hand and the backbet's own flat stake.
- **Rounds advance by decisions**: Starting a round and applying an action
  run on until the next player decision, including dealing, a split hand's
  second card, the dealer's play and the settlement. A timed-out player is
  sent a stand. Each call returns a new round and the events of what
  happened, in order.
- **Immutable rounds as plain JSON**: Every call returns a new round and
  never changes the one passed in. Internally a call works on a mutable
  draft. The round holds no classes and no RNG, so it can be stored, logged
  and replayed.
- **Expected failures are values**: Invalid bets and actions return a result
  with an error code. Exceptions are reserved for programming errors.
- **Nothing secret reaches clients**: Events never contain a face-down hole
  card and can be broadcast unchanged. Snapshots for clients go through the
  engine's public view, which also drops the shoe, because its order reveals
  every card to come. The engine tells the server what an action costs before
  it is applied, so the stake can be reserved first.
- **Rules as data, only where variants are realistic**: The table rules hold
  what may differ between tables or rounds, such as the blackjack payout or
  the hole card rule. Rules without a realistic variant are fixed in the code
  and listed where the table rules are declared. A rule becomes configurable
  once a feature needs it.
- **Stable hand indices**: A split appends the new hand to the seat, so hand
  indices never shift, and hands are played in index order.

### Monorepo, Config and Tests

- **Libraries are built, not transpiled by consumers**: `engine` and `shared`
  compile to `dist/` and are consumed from there. The root scripts build them
  before `dev`, `typecheck`, `lint` and `test`.
- **ESM throughout**: All packages are `"type": "module"`. Relative imports in
  the Node packages carry the `.js` extension.
- **Fail fast on config**: Environment variables are validated with Zod at
  startup. Invalid config stops the boot.
- **Committed env files hold random development values**: `.env.development`
  and `.env.test` are committed with random secrets that only work locally.
  Personal overrides go into the uncommitted `.env.development.local`.
  Validation is the same in every environment; real secrets are set in the
  deployment.
- **Tests next to `src/`, not inside it**: Each package keeps its tests in a
  `tests/` folder whose structure mirrors `src/`. Unit tests are named
  `*.spec.ts` and run without any external service. Tests against Postgres
  are named `*.e2e-spec.ts` and run through `test:e2e`. Long-running
  simulations are named `*.sim.ts` and run only through `test:sim`, not with
  every `test`. The engine's house edge simulation plays millions of hands by
  basic strategy and checks the result against the published house edge for
  the rules, which catches rules that are wrong yet consistent.
- **Real Postgres in tests**: E2e tests run against a throwaway Postgres from
  Testcontainers instead of mocks, migrated with the committed migrations.
  Local development uses the Postgres from `compose.dev.yaml`.
- **E2e test files run one after another on an emptied database**: They
  share one database, so they don't run in parallel. The test app helper
  empties all tables before starting the app, whose startup then creates the
  admin, so every file starts from the same state. Concurrency is tested
  deliberately inside single tests, not by running files at once.
- **Data comes from factories, not SQL seeds**: Tests and the development
  seed create their data with the factories in the server's `seed/` folder,
  which go through the app's services, so the data always satisfies the
  domain rules and follows every migration without maintenance. Each test
  creates its own data with unique names, so tests within a file don't
  depend on each other. Tests never use the seed or any fixed data set; the
  seed only fills the development database.

### Server

- **Feature modules**: Business features get their own folder directly under
  `src/`. Technical concerns that have no business meaning live in
  `src/infrastructure/`. There are no horizontal layers such as
  core/presentation, because the domain logic already lives in the engine.
- **Barrel exports per module**: Each module exposes its public API through
  `index.ts`. Nothing else is imported from outside the module.
- **Modules depend in one direction**: Base modules such as users know
  nothing about the modules built on them. A module that combines several,
  such as auth for registration, puts their steps together itself. Check the
  existing imports before adding one that points the other way.
- **Structured logging with request ids**: Every HTTP request gets an id that
  is attached to all log records written while handling it and is returned as
  `X-Request-Id`. The console gets readable output, and the rotated files get
  JSON.
- **Postgres through Drizzle's query builder**: Queries use the query builder
  and plain SQL, not the relational query API (`db.query`), which changes with
  Drizzle 1.0. The database is injected with `@InjectDrizzle()`. Tables are
  declared in camelCase and stored in snake_case.
- **Tables live with their feature**: Each feature module declares its tables
  in `*.schema.ts` files next to its code. drizzle-kit collects them by that
  pattern.
- **Columns come with the feature that needs them**: Tables start with what
  their first feature uses and grow through further migrations.
- **Table state lives in the server's memory, one instance**: The seats and
  the current round of an open table are held in process memory. The server
  runs as a single instance, which is plenty for closed groups; a restart
  ends the rounds in progress. Callers reach the state only through its
  service, so it can move into the database later.
- **Ids are UUIDv7, amounts are integers**: Primary keys default to
  Postgres' `uuidv7()`, which sorts by creation time. Amounts are whole Bucks
  stored as `bigint`.
- **Migrations are generated, committed and run before the start**: Schema
  changes go through `npm run db:generate -w @bustit/server`. Generated
  migrations are committed and never edited by hand. They are applied as a
  separate step before the server starts, never by the server itself.
  Nothing runs in production yet, so for now schema changes don't get a
  migration of their own: the migrations are regenerated into a single
  initial one (delete `drizzle/`, generate, `npm run services:reset`). Once the
  first production deploy exists, every change gets a new migration.
- **The ledger is the only way to change a balance**: A user's balance
  caches the sum of their ledger entries and is only changed by a ledger
  booking, in the same transaction as the entry. The balance is checked and
  changed in one conditional `UPDATE`, so concurrent bookings can't overdraw
  it, and a check constraint keeps it from going negative. Callers that
  change more than the balance pass their transaction to the booking.
- **Accounts start with a booking**: Creating an account books the starting
  balance in the same transaction. On startup the first admin is created
  from the environment unless an admin exists, under a Postgres advisory lock
  so concurrent starts can't create two.
- **Domain errors over database errors**: Services throw domain errors for
  expected failures such as a taken username. Unique violations are
  translated into them, and constraints are named explicitly, so the
  translation doesn't depend on generated names.
- **Domain errors become HTTP errors in the controller**: The controller that
  calls a service maps its expected domain errors to a status, e.g. invalid
  input to 400 and a conflict to 409.
- **Lists are paged by offset**: List endpoints take `page` (from 0) and
  `perPage` with the page query schema from `@bustit/shared` and answer
  with `{ content, info }`, whose info has the page, its size and the
  totals. Filters apply to the totals as well, so a client can number its
  pages.
- **Lists are filtered with RSQL**: A list takes an RSQL expression as
  `filter`, e.g. `status=in=(open,used)`. Its service declares the fields
  that can be filtered on, each with its SQL expression, its operators and a
  Zod schema for its values, and turns the filter into a `where` condition
  with the filtering helper in `src/infrastructure/`. Anything not declared
  is rejected as a 400, so nothing becomes filterable by accident.
- **Request bodies are validated with the shared schemas**: Controllers parse
  input with the Zod validation pipe and the schemas from `@bustit/shared`,
  which the web client uses as well.

### Server Auth

- **The API is stateless and uses no cookies**: Login returns a signed token
  in the response body, and clients send it as
  `Authorization: Bearer <token>`, so browsers, mobile apps and other clients
  use the API alike. The server keeps no login state.
- **Tokens are checked against the database**: A token only carries the user
  id and a token version. On every request the guard loads the user, rejects
  disabled ones and those whose token version changed, and reads the role
  from the database. Raising the token version ends all logins of a user.
- **Every route requires a login unless marked `@Public()`**: A global guard
  checks the token on every request, so a new route is protected without
  anyone remembering to.
- **Roles are checked by the same guard**: `@Roles(...)` on a controller or
  route limits it to users with one of the roles: 401 without a valid login,
  403 without the role.
- **Management lives in the operations console (BOC)**: Routes for running
  the game live under `/api/boc/...`, short for Bustit Operations Console.
  The prefix names the purpose, not a role; which roles may use a route is
  set with `@Roles`. Each feature module has its own BOC controller, named
  `<feature>.boc.controller.ts`, instead of one module for all of them.
- **Login reveals nothing about accounts**: Unknown users, wrong passwords and
  disabled accounts get the same answer, and unknown users are checked
  against a dummy hash so the response time doesn't tell them apart.
- **Invite codes are stored hashed and redeemed atomically**: Only a hash of
  the normalized code is stored, so case, spaces, dashes and look-alike
  characters don't matter when typed. Registration claims the invite by
  locking its row, creates the account and marks the invite used in one
  transaction, so a code works once even under concurrent attempts, and a
  failed registration leaves it valid. Unknown, used, revoked and expired
  codes fail alike. An invite's status is derived in the database, so expiry
  is judged by the same clock everywhere.

### API Boundaries

- **HTTP for management, Socket.IO for live gameplay**: RESTful HTTP endpoints
  handle request-response operations such as registration, login, user profile and
  master-data retrieval, and other management tasks. Real-time gameplay uses a Socket.IO
  interface over WebSocket for player actions and game-state updates. The WebSocket
  connection is authenticated and authorized independently of the HTTP session. Since
  the browser's native WebSocket API does not support custom authorization headers,
  the connection is established using a short-lived, single-use connection ticket
  obtained through an authenticated HTTP request. Tickets are transmitted during
  the Socket.IO handshake, validated server-side and rejected after use or expiry.
  Sensitive credentials are never placed in long-lived query parameters.

### Web

- **Browsers only talk to the web app (BFF)**: The game server's HTTP API is
  not exposed to browsers. The web server calls it at `SERVER_URL` with the
  user's token from the session and offers browsers only what the UI needs:
  changes as Server Actions in `src/actions/`, data the browser loads as GET
  route handlers below `src/app/api/`, which it fetches with SWR. There is no
  generic proxy that passes requests through: each use case gets its own
  action or route, which calls one function of the server API client in
  `src/lib/server/`, so nothing reaches the game server that the web app
  doesn't call on purpose. A 401 from the game server ends the session and
  sends the user to the login; a 403 is passed on.
- **Sessions with next-auth, token stays on the server**: Login goes through
  next-auth's credentials provider, which calls the game server's login. The
  server's token is kept in next-auth's encrypted, HTTP-only session cookie
  and never reaches browser code: the session the browser sees has the
  user's id, name and role only. A session ends when the token it holds
  expires.
- **Every page requires a login unless public**: The proxy (`src/proxy.ts`)
  sends requests without a session to the login, except for the pages it
  lists as public. A new page is protected without anyone remembering to.
  Pages of the operations console live below `/boc`, whose layout answers
  users who aren't admins with `forbidden()`. With Cache Components the
  session can only be read inside `<Suspense>`, so that answer has the status
  200 rather than 403. These checks only read the session cookie, whose role
  is the one from login time; the game server still checks the token and the
  role on every call.
- **Atomic Design with React Aria**: Atoms wrap React Aria Components with
  the theme's styling; everything above is built from atoms instead of
  styling React Aria primitives directly. Component files are named in
  PascalCase. Components that belong to one area of the app, such as the
  operations console, live in a subfolder of their level named after it,
  e.g. `organisms/boc/`. Content that loads shows a skeleton of its shape.
- **Theme via tokens**: Colors, radii and shadows are CSS variables in
  `globals.css`, exposed to Tailwind. Components use only these tokens, never
  raw palette colors.
- **Dark only, fonts in the repository**: There is no light theme. Fonts are
  committed under `src/app/fonts/` with their licenses and loaded with
  `next/font/local`, so no page loads from Google Fonts. Headings use the
  display font (`font-display`).
- **Forms with Formik and Zod**: Forms validate with Zod schemas and bind
  their fields through the Formik helpers in `src/lib/`. Errors show once a
  field was left or the form was submitted. Form schemas apply the rules
  exported by `@bustit/shared` with messages of their own, so rules aren't
  duplicated but the API's messages don't reach users.
- **i18n from the start**: The UI speaks German and English via `next-intl`.
  Every page lives below `[locale]`; the proxy sends requests without a
  locale to the detected one, German by default. No UI string is hardcoded,
  validation messages included. Message keys are typed against the German
  messages, and the English ones have to mirror them, so a missing or
  misspelled key fails the typecheck. Messages are grouped by `pages` and
  `components`; validation rules and errors used by several forms live under
  `validation`.
- **The locale is a root param**: `[locale]/layout.tsx` is the root layout,
  so the locale comes from `next/root-params` instead of the `params` prop,
  which keeps navigations instant under Cache Components. `next/root-params`
  only works inside `app/`, so the proxy reads the locale from the path.
- **React Aria navigates through Next.js**: A `RouterProvider` in the root
  layout makes React Aria links use next-intl's router and puts the locale
  into their `href`, so links are written without it, e.g. `/login`.
- **Page titles name the page, then the app**: Pages set only their own
  title; the root layout's title template appends `| BustIt`.
- **Discreet entry pages**: Login and registration don't reveal what they
  are for: beyond the name in the title, no page description, texts that say
  nothing about the purpose, and `noindex` for search engines. The texts speak like a bouncer
  at a back door, in keeping with the scenes behind the forms.

## Coding Principles

- **KISS**: Prefer the simplest solution that works. Avoid unnecessary abstractions – extract only after the third repetition (Rule of Three).
- **DRY**: Define logic once, import everywhere. Duplicated code is a maintenance liability.
- **YAGNI**: Don't build features or abstractions on speculation. Implement what's needed now.
- **Single Responsibility**: Each function, component, and module has one clear purpose.
- **Fail Fast**: Validate inputs early, throw meaningful errors immediately. Never swallow exceptions silently.
- **Guard Clauses over Nesting**: Prefer early returns over deeply nested `if/else` blocks.
- **Immutability by Default**: Use `const`, `readonly`, and spread operators. Avoid mutation unless there's a clear performance reason.
- **Explicit over Implicit**: Prefer explicit parameters and return types over hidden assumptions or side effects.

## Comments

- **English only**, like all code.
- **Explain the implementation, not the decision**: A comment may say why
  the code is written this way, what non-obvious constraint it works around
  or what would break if it were done differently. It never argues why a
  feature, rule or value exists at all. Business reasons, product decisions
  and the discussion behind a change belong in the commit message or the docs.
- **Nothing from a session or chat**: Comments never contain reasoning from
  a conversation with an AI or anyone else, such as "as discussed", "the user
  wants" or arguments that were convincing at the time. Write what a reader
  of the code needs, without knowing how it came about.
- **Why, not what**: Don't restate what the code says. `// increment counter`
  before `counter += 1` is noise.
- **Docstrings on public APIs**: Exported functions, classes and types that
  aren't obvious get a `/** ... */` docstring.
- **Multi-line comments use block syntax**: A comment spanning several lines
  is written as `/* ... */` (or `/** ... */` for a docstring), never as
  consecutive `//` lines. `//` is for single-line comments only.

```ts
// Bad: argues the decision and carries over a chat.
// We use cookies here because the user didn't want tokens in localStorage.

/*
 * Good: explains the implementation. The token stays in the encrypted
 * session cookie, so `session` leaves it out of what the browser sees.
 */
```

## General Instructions

- Never dig into node_modules – if you need to understand a dependency, read its docs or types, not its source. If something seems broken, check imports,
  versions, and your own code first. If you need still additional information just ask me.
- Prefer reading before writing – understand the existing structure before generating new files or refactoring. Don't assume conventions; verify them.
- Don't fix what you didn't break – scope changes strictly to what was asked. No opportunistic refactors, formatting fixes, or "while I'm here" changes. But if
  you find something feel free to tell me.
- One task at a time – complete and verify the current task before moving to the next. Don't batch unrelated changes in one go.
- Use npm, never pnpm or yarn.
- Local development and e2e tests need Docker. `npm run dev` starts the
  services from `compose.dev.yaml`, such as the database, and then the dev
  servers on the host. The services keep running afterwards;
  `npm run services:stop` stops them. `npm run services:reset` removes all
  of them with their data, starts them fresh, applies the migrations and
  seeds the database.
- Run the checks listed in [CONTRIBUTING.md](CONTRIBUTING.md) before
  considering a task done.

## Maintaining This File

This file is read by every AI session, so it has to stay short and true.
Check this section before adding to it.

- **What belongs here**: Design decisions on code structure, the project
  setup and the technologies used, and conventions for writing code. Each
  entry is short: the rule and, in a sentence, why it holds.
- **Rules, not names**: Describe concepts and where they live, not concrete
  files, classes or functions, which drift as the code changes. Names stay
  only where they are the convention themselves, such as a file pattern, a
  decorator or an npm script.
- **What doesn't belong here**:
  - Feature descriptions and end-user documentation go into the
    [README](README.md) and the docs it links to.
  - Configuration and deployment of a package, such as its environment
    variables or how it is run in production, go into that package's
    `docs/`, e.g. `packages/<package>/docs/configuration.md` or
    `packages/<package>/docs/deployment.md`.
  - The discussion or reasoning that led to a change goes into the commit
    message.
  - Conventions for contributing, such as the commit message format, go
    into [CONTRIBUTING.md](CONTRIBUTING.md).
  - Lists of what exists, such as all modules or components, are read from
    the code itself.
- **Change entries instead of appending**: If an entry covers the topic,
  update it rather than adding a new one. When a change makes an entry
  wrong, fix or remove it in the same change.
