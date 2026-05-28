# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@10.32.1 --activate
ENV NEXT_TELEMETRY_DISABLED=1
# 059 Phase 0: NEXT_PUBLIC_* инлайнятся в бандл и читаются статически
# генерируемыми страницами НА СБОРКЕ. Без этого build-arg getSiteUrl() падает
# в localhost-fallback → canonical/OG на статических страницах (b2b, company,
# knowledge, documents, legal) указывают на http://localhost:3000.
# Значение пробрасывается из docker-compose build.args.
ARG NEXT_PUBLIC_SITE_URL=https://pdumarket.ru
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
# При сборке БД недоступна — catalog.ts graceful-fallback'ит на пустой каталог.
# /catalog/[...slug]/ и /product/[slug]/ помечены dynamic = "force-dynamic",
# поэтому на runtime отрендерятся из живой Postgres.
RUN pnpm --filter @soliton/web build

FROM node:22-alpine AS runner
WORKDIR /app
# font-dejavu — для embedded шрифта в PDF-счетах (pdfkit + кириллица).
# Установлен в /usr/share/fonts/dejavu/ — путь жёстко прописан в /api/invoice route.
RUN apk add --no-cache libc6-compat tini font-dejavu \
    && corepack enable \
    && corepack prepare pnpm@10.32.1 --activate
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/00-source-data ./00-source-data

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "@soliton/web", "start"]
