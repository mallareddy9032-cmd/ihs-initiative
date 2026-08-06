# ============================================================================
# FILE: services/cloud-engine/Dockerfile
# CONTEXT: Multi-stage production image for IHS Cloud Engine (Node.js / Express / Prisma)
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies & compile TypeScript
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Native module build toolchain (bcrypt) + OpenSSL for Prisma engines
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install full dependency tree for compilation
RUN npm ci

COPY tsconfig.json tsconfig.server.json ./
COPY src ./src

# Generate Prisma Client and emit path-rewritten CommonJS to dist/
ENV DATABASE_URL="postgresql://build:build@localhost:5432/ihs_build?schema=public"
RUN npx prisma generate \
  && npx tsc --project tsconfig.server.json

# Prune to production dependencies for the runtime layer
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: Minimal production runtime
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 ihs \
  && useradd --system --uid 1001 --gid ihs ihs

# Production node_modules (includes @prisma/client engines)
COPY --from=builder --chown=ihs:ihs /app/node_modules ./node_modules
COPY --from=builder --chown=ihs:ihs /app/package.json ./package.json
COPY --from=builder --chown=ihs:ihs /app/dist ./dist
COPY --from=builder --chown=ihs:ihs /app/prisma ./prisma

USER ihs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/healthz" || exit 1

# tsc-alias rewrites @/ imports — no tsconfig-paths required at runtime
CMD ["node", "dist/server.js"]
