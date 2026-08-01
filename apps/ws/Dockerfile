# Socket.io сервер (реалтайм обеих игр).
# Собирается из корня монорепо — нужен packages/shared и prisma/schema.prisma.
#
#   docker build -f apps/ws/Dockerfile -t alias-ws .

# ─── Зависимости ───
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/ws/package.json apps/ws/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ─── Сборка ───
FROM node:22-bookworm-slim AS build
WORKDIR /app
# npm workspaces хостят всё в корневой node_modules, включая симлинки
# на @alias/shared — отдельных папок в apps/* нет.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# esbuild собирает src/ и @alias/shared в один файл; тяжёлые нативные
# зависимости остаются внешними и ставятся отдельно на следующем шаге.
RUN npm run build --workspace @alias/ws

# ─── Прод-зависимости отдельным слоем ───
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/ws/package.json apps/ws/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ─── Запуск ───
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/ws/dist ./apps/ws/dist
COPY --chown=node:node apps/ws/package.json ./apps/ws/package.json

USER node
EXPOSE 3001
CMD ["node", "apps/ws/dist/index.js"]
