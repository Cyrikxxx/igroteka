# Next.js-приложение (страницы + REST API).
# Собирается из корня монорепо: контекст сборки — вся репа, иначе не видно
# packages/shared и корневой prisma/schema.prisma.
#
#   docker build -f apps/web/Dockerfile -t alias-web .

# ─── Зависимости ───
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Копируем только манифесты — слой с npm ci переиспользуется, пока
# зависимости не поменялись.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/ws/package.json apps/ws/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ─── Сборка ───
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# npm workspaces хостят всё в корневой node_modules, включая симлинки
# на @alias/shared — отдельных папок в apps/* нет.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Клиент Prisma нужен уже на сборке: страницы и роуты его импортируют.
RUN npx prisma generate
RUN npm run build --workspace @alias/web

# ─── Запуск ───
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone уже содержит нужный срез node_modules, включая движки Prisma.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
