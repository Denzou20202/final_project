# Builds both frontend SPAs, then bakes their static output straight into
# an nginx image alongside nginx.prod.conf — one container is the whole
# "web tier": TLS termination, API reverse proxy, and static file serving
# for operator-app (/staff/) and client-portal (/).

FROM node:24-slim AS build
WORKDIR /workspace

COPY . .
# See infra/docker/backend.Dockerfile for the npm ci fix history.
RUN npm ci

# NX auto-loads the *workspace root* .env and injects it into process.env
# before Vite ever runs, which shadows each app's own .env.production
# (Vite treats existing process.env values as highest priority, never
# overridden by .env files) — this single flag is the actual fix; see the
# git history on frontend/operator-app/vite.config.mts for the full story.
ENV NX_LOAD_DOT_ENV_FILES=false
RUN npx nx build operator-app
RUN npx nx build client-portal

FROM nginx:1.27-alpine
COPY infra/nginx/nginx.prod.conf /etc/nginx/nginx.conf
# No certs COPY here — nginx.prod.conf reads TLS material exclusively from
# /etc/letsencrypt (mounted at runtime from the certbot_certs volume, see
# docker-compose.prod.yml). infra/nginx/certs/ is dev-only (self-signed
# localhost.{crt,key}, used by the plain nginx:1.27-alpine + volume mount
# in docker-compose.yml, and gitignored) — copying it here was always dead
# weight for this image, and broke building it from a fresh clone outright,
# since that directory doesn't exist until someone generates a local cert.
COPY --from=build /workspace/frontend/operator-app/dist /usr/share/nginx/operator-app
COPY --from=build /workspace/frontend/client-portal/dist /usr/share/nginx/client-portal
