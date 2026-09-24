# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
# The release workflow adds the version, revision and build time (.github/workflows/release.yml).
LABEL org.opencontainers.image.title="OpenInvites" \
      org.opencontainers.image.description="Self-hostable event pages that guests RSVP to without an account" \
      org.opencontainers.image.source="https://github.com/leongyeehang/OpenInvites" \
      org.opencontainers.image.licenses="AGPL-3.0"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# The standalone output leaves public/ out: the curated scenes and the title fonts are served from it.
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
# The standalone output keeps postgres under pnpm's store path only (next.config.ts lists it as
# external). Link it where Node resolves bare imports, so the operator commands in scripts/ run.
RUN cd node_modules && ln -s "$(find .pnpm -maxdepth 3 -type d -path '*/node_modules/postgres')" postgres \
  && test -f postgres/package.json
# Hosts' uploaded pictures, on local disk unless the operator configures S3 (ADR-0003). Owned by
# the app's user, so a named volume mounted here starts out writable.
RUN mkdir uploads && chown node:node uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
