FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
RUN npm ci --workspace @bustit/web --include-workspace-root

COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# Next.js builds this into the client bundle, so it has to be passed at build time.
ARG NEXT_PUBLIC_GAME_SERVER_URL

ENV NEXT_OUTPUT_MODE=standalone \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w @bustit/shared -w @bustit/web

FROM node:24-alpine AS web

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S app && adduser -S -G app app

COPY --from=builder --chown=app:app /app/packages/web/.next/standalone ./
COPY --from=builder --chown=app:app /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder --chown=app:app /app/packages/web/public ./packages/web/public

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "packages/web/server.js"]
