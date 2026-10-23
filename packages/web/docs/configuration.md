# Configuration

The web app needs very little configuration. Basically, there are two types: build time
configuration, read when the app is built, and runtime configuration, read by the web server that
renders the pages, runs the Server Actions and talks to the game server.

Both are set through environment variables or, as an alternative, environment files in the web
app's directory. For local development, `.env.development` is committed with values that only work
locally; personal overrides go into the uncommitted `.env.development.local`. A template for a
deployment is available at [`.env.example`](../.env.example).

---

**NOTE**

The configuration is based on the technical possibilities of [Next.js](https://nextjs.org/), see
[Next.js Environment Variables](https://nextjs.org/docs/app/guides/environment-variables). The web
app only uses a part of what is technically possible, but the principles of Next.js still apply,
such as the order in which environment files are loaded.

---

## Configuration Options

### Build time configuration

Changing these variables requires a rebuild of the web app.

| Environment Variable        | Description                                                                                                                                                                                                                                                  | Required |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NEXT_OUTPUT_MODE            | Set to `standalone` to build a self-contained server for a container image. Unset, a regular build is made.                                                                                                                                                  | No       |
| NEXT_PUBLIC_GAME_SERVER_URL | URL the browser connects to the game server's live connection at, without the `/api` prefix (e.g. `http://<HOST>:8080`). Browsers connect to it directly, so it must be reachable from them. It is public and holds no secret, and it is built into the app. | Yes      |

`NEXT_PUBLIC_GAME_SERVER_URL` is the only `NEXT_PUBLIC_` variable. Next.js builds the value into the
JavaScript sent to the browser, so every browser can read it. That is intended for the game server's
address, but it must never hold a secret. A change needs a rebuild of the web app.

When the web app is built as a container image, pass the variable as a build argument:

```bash
docker build --build-arg NEXT_PUBLIC_GAME_SERVER_URL=http://<HOST>:8080 -f packages/web/Dockerfile .
```

### Runtime configuration

Changing these variables requires a restart of the web server. They are validated when the server
starts, and a missing or malformed variable stops it.

| Environment Variable | Description                                                                                                                  | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| SERVER_URL           | URL the web server reaches the game server at, without the `/api` prefix (e.g. `http://<HOST>:8080`). Browsers never see it. | Yes      |
| AUTH_SECRET          | Secret that encrypts the session cookie. At least 32 characters, random in production. Changing it ends all sessions.        | Yes      |
