# Configuration

The game server is configured at runtime through environment variables. Changing them requires a
restart of the server. They are validated at startup, and a missing or malformed variable stops the
boot instead of surfacing later at the first use.

As an alternative to setting them in the environment, the variables can be put into environment
files in the server's working directory. The server reads, in this order of precedence:

1. `.env.<NODE_ENV>.local`
2. `.env.<NODE_ENV>`
3. `.env.local`
4. `.env`

Variables set in the environment itself take precedence over all files. For local development,
`.env.development` and `.env.test` are committed with values that only work locally; personal
overrides go into the uncommitted `.env.development.local`. A template for a deployment is
available at [`.env.example`](../.env.example).

---

**NOTE**

The configuration is based on the technical possibilities of [NestJS](https://nestjs.com/), see
[NestJS Configuration](https://docs.nestjs.com/techniques/configuration). The server only uses a
part of what is technically possible, but the principles of NestJS still apply.

---

## Configuration Options

### Server Configuration

| Environment Variable | Description                                                                                                              | Required |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| NODE_ENV             | The environment the server runs in. One of `development`, `production` or `test`. Also selects which env files are read. | Yes      |
| PORT                 | The port the server listens on. Default is `8080`.                                                                       | No       |

### Datasource Configuration

| Environment Variable | Description                                                                                         | Required |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| DATABASE_URL         | Connection URL of the PostgreSQL database (e.g. `postgres://<USER>:<PASSWORD>@<HOST>:5432/bustit`). | Yes      |

Migrations are applied with `npm run db:migrate -w @bustit/server` before the server starts. The
migration tool reads `DATABASE_URL` from the same environment files.

### Security Configuration

| Environment Variable | Description                                                                                                      | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| JWT_SECRET           | Secret that signs the auth tokens. At least 32 characters, random in production. Changing it ends all logins.    | Yes      |
| ADMIN_USERNAME       | Username of the admin created on startup unless an admin exists already. 3 to 20 letters, digits or underscores. | Yes      |
| ADMIN_PASSWORD       | Password of that admin. At least 10 characters. Only used when the admin is created.                             | Yes      |

### Game Configuration

| Environment Variable | Description                                                               | Required |
| -------------------- | ------------------------------------------------------------------------- | -------- |
| STARTING_BALANCE     | Bucks booked once to every new account. Default is `1000`.                | No       |
| INVITE_VALIDITY_DAYS | Days an invite code can be redeemed after it was created. Default is `7`. | No       |

### Logging Configuration

| Environment Variable | Description                                                                                                | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| LOG_LEVEL            | The minimum level that is logged. One of `error`, `warn`, `info`, `debug` or `verbose`. Default is `info`. | No       |
| LOG_DIR              | The directory the rotated JSON log files are written to. Default is `./logs`.                              | No       |
