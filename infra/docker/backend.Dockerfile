# Shared Dockerfile for every NestJS backend service in this NX monorepo —
# only APP_NAME (and the port each service listens on, set via docker-compose)
# differ between services. Build with:
#   docker build -f infra/docker/backend.Dockerfile --build-arg APP_NAME=ticket-service -t veloxdesk/ticket-service .
#
# This copies the whole hoisted npm-workspace node_modules into the runtime
# image rather than using NX's prune targets — larger image than strictly
# necessary (frontend deps like React/Vite get hoisted into the same root
# node_modules and end up along for the ride), but simple and reliable.
# Worth revisiting with `@nx/js:prune-lockfile` if image size ever matters
# for this deployment (local self-hosting, not bandwidth-constrained).

# Shared base for both real branches below: the app-runtime image (build →
# runtime) and the migrator image (deps → migrator, no app compile at all).
# Split out specifically so `docker build --target migrator` never needs an
# APP_NAME build-arg or an `nx build` — migrations only need libs/database's
# source + the typeorm CLI, nothing app-specific.
FROM node:24-slim AS deps
WORKDIR /workspace

COPY . .
# npm ci verified working — repro'd cleanly inside node:24-slim on
# linux/arm64 (this Mac's actual Docker Desktop engine) after regenerating
# package-lock.json from inside a Linux container (npm install
# --package-lock-only fixed a real, narrow gap: @unrs/resolver-binding-
# wasm32-wasi's own nested @emnapi/core@1.10.0/@emnapi/runtime@1.10.0
# dependencies were missing from the lock — an optional WASM-fallback
# package that never actually gets installed on any real platform here, so
# a plain `npm install` on macOS never needed to resolve/record its own
# transitive deps, but npm ci's strict validation still requires the
# record to be complete). Confirmed 2026-08-27; independently corroborated
# by .github/workflows/ci.yml's own plain `npm ci` on ubuntu-latest.
RUN npm ci

FROM deps AS build
ARG APP_NAME
RUN npx nx build ${APP_NAME}

# Runs migrations against prod Postgres via `docker compose run --rm
# migrator` (see docker-compose.prod.yml's migrator: service, gated behind
# the `tools` profile so it never starts with a plain `up`) — replaces the
# previous ad-hoc process of running `DB_HOST=localhost npm run
# migration:run` by hand from a developer's laptop against the
# 127.0.0.1-published Postgres port. `deps` already has everything this
# needs (full TS source under libs/database/src/migrations, the typeorm
# CLI and ts-node as devDependencies from the unfiltered `npm ci` above) —
# no separate build step, no APP_NAME.
FROM deps AS migrator
CMD ["npm", "run", "migration:run"]

FROM node:24-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
# Each service's webpack config outputs to apps/<name>/dist (its own dist,
# not a shared top-level dist/apps tree) — only that one app's build is
# copied in, not every service's compiled output.
COPY --from=build --chown=node:node /workspace/apps/${APP_NAME}/dist ./dist

# node:24-slim ships a built-in non-root `node` user (uid/gid 1000) — no
# creation step needed. None of these services bind a privileged (<1024)
# port or write to disk at runtime (grepped all 6 apps), so there's no
# functional reason to run as root; this only limits blast radius if one of
# them is ever compromised. The build stage above stays root — its
# filesystem is discarded except for the two COPY --from=build paths above,
# which are already re-owned to node here.
USER node
CMD ["node", "dist/main.js"]
