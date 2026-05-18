# Alias Online

Онлайн-версия настольной игры **Alias** — объясняй слово, не называя
однокоренных, угадывай быстрее соперников.

Два режима:

- **Локальный** — одно устройство на компанию, передаёте по очереди.
- **Онлайн** — хост создаёт комнату с кодом, игроки заходят со своих
  телефонов; объясняющий видит слово приватно, остальные — только
  карточку «X объясняет». Реальное время через WebSocket.

## Стек

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind 4
- **Socket.io** — реалтайм онлайн-режима
- **Prisma + PostgreSQL** (Neon) — долговременные данные
- **Redis** (Upstash) — состояние онлайн-комнат
- **Vercel** (фронт + REST) + **Railway** (WebSocket-сервер)

Монорепо на npm workspaces:

```
apps/web        Next.js — страницы + REST API   → Vercel
apps/ws         Socket.io сервер                → Railway
packages/shared общие типы, токены, константы
prisma/         схема БД, миграции, seed
```

Подробно про архитектуру, связь сервисов и деплой —
[`project-context/ARCHITECTURE.md`](project-context/ARCHITECTURE.md).

## Запуск локально

```bash
npm install
cp .env.example .env   # затем заполнить значения (см. ниже)
npm run db:migrate     # применить схему к БД
npm run db:seed        # залить категории и слова
npm run dev            # web :3000 + ws :3001
```

Открыть http://localhost:3000

### Переменные окружения (`.env` в корне)

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL (Neon) |
| `REDIS_URL` | Redis (Upstash), `rediss://...` |
| `WS_TOKEN_SECRET` | HMAC-секрет WS-токенов (один и тот же для web и ws) |
| `NEXT_PUBLIC_WS_URL` | URL WS-сервера (`http://localhost:3001` в dev) |

`.env` в `.gitignore` — секреты в репозиторий не попадают.

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | web + ws одновременно |
| `npm run build` | прод-сборка (prisma generate + migrate + next build) |
| `npm run typecheck` | TypeScript-проверка обоих пакетов |
| `npm run db:migrate` | новая миграция Prisma (dev) |
| `npm run db:seed` | залить словарь |
| `npm run db:studio` | Prisma Studio |

## Деплой

CI/CD автоматический: `git push` в `main` →

- **Vercel** пересобирает `apps/web`
- **Railway** пересобирает `apps/ws` (если менялись `apps/ws`,
  `packages/shared` или `prisma`)

Пошаговая инструкция и нюансы — в
[`project-context/ARCHITECTURE.md`](project-context/ARCHITECTURE.md)
(разделы 6–7).
