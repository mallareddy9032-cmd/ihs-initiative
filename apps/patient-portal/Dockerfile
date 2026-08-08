# syntax=docker/dockerfile:1.7
# ============================================================================
# IHS Patient Portal — Next.js standalone production image
# Build from repository root:
#   docker build -f apps/patient-portal/Dockerfile -t ihs-patient-portal:latest .
# ============================================================================


ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=9.15.4

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
ENV IHS_DB_MOCK=true
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/ihs_build?schema=public"
COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ihs/db generate
RUN pnpm --filter @ihs/patient-portal build

FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV IHS_DB_MOCK=true
WORKDIR /workspace

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/patient-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/patient-portal/.next/static ./apps/patient-portal/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/patient-portal/public ./apps/patient-portal/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/patient-portal/server.js"]
