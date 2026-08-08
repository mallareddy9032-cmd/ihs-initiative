# syntax=docker/dockerfile:1.7
# ============================================================================
# IHS Phase 5 — Root multi-stage Dockerfile (Next.js standalone)
# Build from repository root:
#   docker build --build-arg APP_DIR=patient-portal --build-arg APP_PKG=@ihs/patient-portal --build-arg APP_PORT=3000 -t ihs-patient-portal .
#   docker build --build-arg APP_DIR=clinical-workspace --build-arg APP_PKG=@ihs/clinical-workspace --build-arg APP_PORT=3002 -t ihs-clinical-workspace .
#   docker build --build-arg APP_DIR=operations-hub --build-arg APP_PKG=@ihs/operations-hub --build-arg APP_PORT=3001 -t ihs-operations-hub .
# Prefer app-specific Dockerfiles under apps/*/Dockerfile for CI matrix builds.
# ============================================================================


ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=9.15.4
ARG APP_DIR=patient-portal
ARG APP_PKG=@ihs/patient-portal
ARG APP_PORT=3000

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/types/package.json ./packages/types/
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/db/package.json ./packages/db/
COPY apps/patient-portal/package.json ./apps/patient-portal/
COPY apps/clinical-workspace/package.json ./apps/clinical-workspace/
COPY apps/operations-hub/package.json ./apps/operations-hub/
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG APP_DIR
ARG APP_PKG
ENV IHS_DB_MOCK=true
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/ihs_build?schema=public"
COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ihs/db generate
RUN pnpm --filter ${APP_PKG} build

FROM node:${NODE_VERSION}-alpine AS runner
ARG APP_DIR
ARG APP_PORT
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_DIR=${APP_DIR}
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0
ENV IHS_DB_MOCK=true
WORKDIR /workspace

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/${APP_DIR}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/${APP_DIR}/.next/static ./apps/${APP_DIR}/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/${APP_DIR}/public ./apps/${APP_DIR}/public

USER nextjs
EXPOSE ${APP_PORT}
CMD ["sh", "-c", "node apps/${APP_DIR}/server.js"]
