# Alias Online — архитектура и как всё работает

Документ описывает, из чего состоит проект, как сервисы связаны между
собой и что куда деплоится. Читай его первым, если вернулся к проекту
после перерыва или открыл его впервые.

---

## 1. Что это

Онлайн-версия настольной игры **Alias** (объясни слово, не называя его).
Два режима:

- **Локальный** — одно устройство на компанию, передают по очереди.
  Работает без WebSocket, только REST + Postgres.
- **Онлайн** — хост создаёт комнату с кодом, игроки заходят со своих
  телефонов. Объясняющий видит слово приватно, остальные — карточку
  «X объясняет». Реальное время через WebSocket + Redis.

---

## 2. Монорепо: три пакета

Проект — это **npm workspaces** монорепо. Один git-репозиторий, внутри
три независимых пакета:

```
alias-online/
├── apps/
│   ├── web/          → Next.js (фронт + REST API). Деплой: Vercel
│   └── ws/           → Socket.io сервер (реалтайм). Деплой: Railway
├── packages/
│   └── shared/       → общий TypeScript-код (типы, токены, константы)
├── prisma/           → схема БД + миграции + seed (общий для web и ws)
├── vercel.json       → конфиг сборки для Vercel
├── package.json      → корневой; workspaces + общие скрипты
└── .env              → секреты (НЕ в git; на проде задаются в Vercel/Railway)
```

### Зачем монорепо

`apps/web` и `apps/ws` используют **одни и те же типы** игровых событий
и **один и тот же секрет** для подписи токенов. Если бы это были
отдельные репозитории, типы бы разъезжались и появлялись баги «фронт
шлёт одно, сервер ждёт другое». В монорепо обе стороны импортируют из
`@alias/shared` — поменял в одном месте, TypeScript ругается везде.

---

## 3. Четыре внешних сервиса

| Сервис | Роль | Где |
|---|---|---|
| **Vercel** | Хостит `apps/web`: страницы Next.js + REST API (`/api/*`) | vercel.com |
| **Railway** | Хостит `apps/ws`: постоянный WebSocket-сервер | railway.app |
| **Neon** | PostgreSQL — долговременные данные (юзеры, игры, словарь, история) | neon.tech |
| **Upstash** | Redis — «горячее» состояние онлайн-комнат (фаза, таймер, очередь слов) | upstash.com |

### Почему web и ws на разных хостингах

Vercel — **serverless**: функция отвечает на запрос и умирает. Держать
постоянное WebSocket-соединение там нельзя. Поэтому реалтайм-сервер
вынесен на Railway, где процесс живёт постоянно.

### Почему две базы

- **Postgres (Neon)** — source of truth. Что должно пережить
  перезагрузку и остаться в истории: пользователи, словарь, сыгранные
  игры, раунды, очки.
- **Redis (Upstash)** — временный кеш онлайн-комнаты. Чья сейчас
  очередь, сколько секунд осталось, какие слова в очереди. TTL 24 часа.
  Если пропадёт — игра восстановится из последнего снапшота в Postgres.

---

## 4. Как сервисы связаны (схема)

```
                 Браузер игрока
                  /          \
        HTTPS (страницы,      WSS (реалтайм:
         REST /api/*)          лобби, раунды)
                 |                   |
                 v                   v
        ┌─────────────────┐  ┌──────────────────┐
        │ Vercel          │  │ Railway          │
        │ apps/web        │  │ apps/ws          │
        │ Next.js         │  │ Socket.io        │
        └────┬───────┬────┘  └────┬────────┬────┘
             │       │            │        │
       Prisma│       │ ioredis    │ Prisma │ ioredis
             v       v            v        v
        ┌─────────┐  ┌──────────────────────────┐
        │ Neon    │  │ Upstash Redis            │
        │ Postgres│  │ (room:<code> снапшоты)   │
        └─────────┘  └──────────────────────────┘
```

Vercel и Railway **оба** ходят и в Neon, и в Upstash. Между собой
напрямую не общаются — связь через общий Redis (снапшот комнаты) и через
подписанный токен (см. ниже).

### Аутентификация WebSocket (ключевой момент)

Cookie на `*.vercel.app` не доедет до `*.railway.app` (разные домены).
Поэтому связь web↔ws не на cookie, а на **подписанном токене**:

1. Браузер создаёт/входит в комнату → REST-запрос к **Vercel**
   (`POST /api/rooms` или `/api/rooms/[code]/join`).
2. Vercel подписывает токен HMAC-секретом `WS_TOKEN_SECRET`
   (полезная нагрузка: `userId`, `roomCode`, `role`, `exp`).
3. Браузер открывает WebSocket к **Railway**, передаёт этот токен.
4. Railway проверяет подпись **тем же** `WS_TOKEN_SECRET`.

> Поэтому `WS_TOKEN_SECRET` обязан быть **байт-в-байт одинаковым** на
> Vercel и Railway. Несовпадение → ошибка `invalid token`.

---

## 5. Поток данных

### Локальная игра (без WebSocket)

```
Браузер → Vercel REST → Neon
```
1. `/local/new` → `/local/settings` собирают команды и настройки.
2. `POST /api/games` создаёт игру в Postgres.
3. `/local/[id]/round` тянет слова `GET /api/games/[id]/words`.
4. `POST /api/games/[id]/rounds` фиксирует раунд (счёт, переход хода).
5. `/results/[gameId]` показывает итоги.

Идентификация — анонимная cookie `aid` (ставится `apps/web/src/proxy.ts`,
это Next.js 16 переименованный middleware).

### Онлайн-игра (WebSocket)

```
Браузер ─REST→ Vercel ─Postgres→ Neon
   │
   └─WSS→ Railway ─Redis→ Upstash
                  └─Postgres→ Neon (снапшот при старте/конце раунда)
```

1. Хост: `POST /api/rooms` (Vercel) → создаётся `Room` в Postgres +
   стартовый снапшот в Redis + выдаётся WS-токен.
2. Браузер коннектится к Railway, шлёт `room:hello` → получает снапшот.
3. Лобби: события `team:create/join/...` меняют снапшот в Redis,
   Railway рассылает `room:state` всем (debounce 50мс).
4. Хост жмёт «Начать игру» → `round:start_game`. Railway создаёт
   `Game/Team/Player` в Postgres, гоняет машину состояний:
   `LOBBY → PRE_ROUND (3-2-1) → ROUND_ACTIVE → ROUND_REVIEW →
   BETWEEN_ROUNDS → FINISHED`.
5. Слово объясняющему шлётся **приватно** (`socket.emit` конкретному
   сокету), остальные видят только счётчик. Через DevTools слово
   подсмотреть нельзя.
6. При `review_confirm` раунд пишется в Postgres транзакцией.
7. При победе → `/results/[gameId]` (та же страница, что у локальной).

---

## 6. Переменные окружения

Локально все лежат в `.env` в корне (НЕ коммитится). На проде
задаются в дашбордах Vercel и Railway.

| Переменная | Где нужна | Что это |
|---|---|---|
| `DATABASE_URL` | Vercel + Railway | Строка подключения к Neon |
| `REDIS_URL` | Vercel + Railway | `rediss://...` к Upstash |
| `WS_TOKEN_SECRET` | Vercel + Railway | HMAC-секрет токенов. **Должен совпадать!** |
| `NEXT_PUBLIC_WS_URL` | Vercel | Публичный URL Railway, напр. `https://aliasws-production.up.railway.app` |
| `WS_CORS_ORIGIN` | Railway | URL Vercel-приложения (CORS-белый список) |
| `NODE_ENV=production` | Railway | Включает строгий CORS |
| `PORT` | Railway (авто) | Railway сам подставляет; WS его читает |

Локальные `apps/web/next.config.ts` и `apps/ws/src/env.ts` подгружают
корневой `.env` в `process.env`. На проде файла `.env` нет — значения
берутся напрямую из окружения хостинга (это нормально, в логах Railway
строка `[ws] no .env ... relying on process.env only` — не ошибка).

---

## 7. Деплой и CI/CD

Полностью автоматический. После `git push` в ветку `main`:

- **Vercel** видит push → запускает корневой `build`
  (`prisma generate && prisma migrate deploy && next build`) →
  выкатывает `apps/web`. ~2-3 мин.
- **Railway** видит push → если менялись `apps/ws/**`,
  `packages/shared/**` или `prisma/**` (Watch Paths) → пересобирает
  `apps/ws`. ~1 мин.

Ручных шагов нет. Откат — кнопкой в дашборде Vercel/Railway.

### Vercel-специфика

- `vercel.json` говорит собирать из корня монорепо (нужно для
  `prisma migrate deploy` и доступа к `@alias/shared`), а output брать
  из `apps/web/.next`.
- Application Preset в UI показывает «Other» — это норма, `vercel.json`
  перекрывает.
- Prisma использует **классический генератор `prisma-client-js`**
  (вывод в `node_modules/@prisma/client`), потому что новый генератор
  `prisma-client` плохо бандлится в монорепо на Vercel.

### Railway-специфика

- Root Directory пустой (нужен корень монорепо для `@alias/shared`).
- Build: `npm install && npx prisma generate`.
- Start: `cd apps/ws && npm start`.
- Healthcheck: `/health` (отдаёт `{ok, redis:PONG}`).

---

## 8. Локальная разработка

```bash
npm install
npm run dev      # поднимает web (:3000) и ws (:3001) одновременно
```

- `npm run typecheck` — tsc по обоим пакетам.
- `npm run db:migrate` — новая миграция Prisma (dev).
- `npm run db:seed` — залить категории + слова.
- `npm run db:studio` — Prisma Studio (просмотр БД).

Доступ с телефона по локальной сети: открыть `http://<IP-ПК>:3000`.
`apps/web/next.config.ts` → `allowedDevOrigins` уже разрешает приватные
LAN-диапазоны (иначе Next.js 16 блокирует cross-origin dev-ресурсы).
Сервер WS при LAN-доступе отдаётся с тем же хостом и портом 3001
(логика в `apps/web/src/lib/ws-token.ts`).

---

## 9. Где что лежит в коде

| Путь | Что |
|---|---|
| `apps/web/src/app/` | страницы (App Router) + REST `api/` |
| `apps/web/src/app/proxy.ts` | Next.js 16 middleware → ставит cookie `aid` |
| `apps/web/src/hooks/useRoom.ts` | клиентская стейт-машина онлайн-комнаты |
| `apps/web/src/lib/` | prisma, redis, room-snapshot, ws-token, socket-client |
| `apps/ws/src/index.ts` | вход WS-сервера, HTTP `/health` |
| `apps/ws/src/handlers/lobby.ts` | события лобби (team:*, room:*) |
| `apps/ws/src/handlers/round.ts` | игровой цикл (машина состояний) |
| `apps/ws/src/services/` | score / turn / word / timer / game / roundState |
| `packages/shared/src/domain.ts` | доменные типы + типы WS-событий |
| `packages/shared/src/token.ts` | sign/verify WS-токенов (HMAC) |
| `packages/shared/src/snapshot-builders.ts` | чистые трансформации снапшота |
| `prisma/schema.prisma` | схема БД (источник истины §2.2 ТЗ) |

---

## 10. Известные ограничения (не блокеры)

- Neon в регионе us-east-1 → латентность из РФ ~150-300мс на SQL.
  Ускорится при переносе БД в EU-регион.
- «Зомби-комнаты»: если хост закрыл вкладку без «Закрыть комнату» —
  запись `Room` остаётся в БД. На игру не влияет.
- Если объясняющий выпал на экране итогов раунда — раунд можно только
  бросить, закрыв комнату (нет host force-confirm).
- Звук конца раунда и реакции-эмодзи в онлайне — намеренно вырезаны.
