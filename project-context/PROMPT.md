# PROMPT — Alias Online v2

> Этот файл — точка входа в контекст проекта. Хранит исходный промпт и полное ТЗ.
> Если открываешь новый чат — читай его первым, потом `CURRENT_CODE.md` и `DESIGN.md`.

---

## 1. Исходный промпт

```
У тебя есть две папки
alias-game - существующий проект
design - дизайн проект


Ты опытный senior full-stack разработчик.
Я хочу переписать существующий проект игры Alias с нуля,
расширив его до платформы с онлайн-режимом.

## Контекст
Есть рабочая версия Alias на одном устройстве.
Новая версия — тот же Alias, но с тремя режимами запуска:

- "Создать онлайн комнату" — хост создаёт, другие подключаются
  со своих устройств по коду
- "Присоединиться к комнате" — ввести код и войти
- "Локальная игра" — как сейчас, всё на одном устройстве

Никаких других игр пока нет.

## Стек (зафиксирован)
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL (Neon)
- Socket.io (новое — для онлайн режима)
- Redis (новое — состояние онлайн комнат)
- Vercel (фронт) + Railway (Socket.io сервер)

## Изучи текущий проект
Перед написанием ТЗ изучи все файлы проекта, главные:
- prisma/schema.prisma
- types/game.ts
- components/GameBoard.tsx
- app/api/games/route.ts
- app/api/games/[id]/rounds/route.ts

## Задача — написать полное ТЗ:

1. АРХИТЕКТУРА И СТРУКТУРА ПАПОК
2. БАЗА ДАННЫХ
3. API ENDPOINTS
4. WEBSOCKET СОБЫТИЯ
5. UI/UX FLOW
6. ИГРОВАЯ ЛОГИКА

## После написания ТЗ
Создай папку project-context/ в корне проекта со следующими файлами:
project-context/
├── PROMPT.md          ← этот промпт + финальное ТЗ
├── CURRENT_CODE.md    ← ключевые файлы старого проекта
└── DESIGN.md          ← описание дизайна
```

> Замечание по фактам: в текущем репозитории нет `types/game.ts` и
> `components/GameBoard.tsx`. Реальные эквиваленты —
> `src/types/index.ts` и набор `src/components/game/*.tsx`
> (`WordCard`, `RoundSummary`, `TeamForm`, `SettingsForm`, `GameHistory`,
> `WinnerBanner`). В `CURRENT_CODE.md` изучены именно реальные файлы.

---

## 2. Финальное ТЗ — Alias Online v2

### 2.0. Высокоуровневая идея

Один и тот же UI/движок Alias, поверх которого — три точки входа:
- **Локальная игра** (как сейчас): одно устройство, передают друг другу.
- **Создать онлайн-комнату**: хост заводит комнату, отдаёт 6-символьный код
  / ссылку / QR. Остальные подключаются со своих устройств. Объясняющий
  видит слово, остальные — карточку «Объясняет N».
- **Присоединиться к комнате**: ввести код → попасть в лобби → ждать
  старта.

Локальный режим работает полностью без WebSocket и без Redis — только
Postgres + REST. Онлайн-режим строится поверх Socket.io + Redis.

---

### 2.1. АРХИТЕКТУРА И СТРУКТУРА ПАПОК

#### 2.1.1. Развёртывание

```
┌─────────────────────────┐         ┌──────────────────────┐
│   Vercel                │         │   Railway            │
│   Next.js App Router    │         │   Node.js + Socket.io│
│   - SSR/RSC pages       │         │   - WS rooms         │
│   - REST /api/* (Prisma)│         │   - Game loop (timer)│
└──────────┬──────────────┘         └──────────┬───────────┘
           │  Prisma                           │ ioredis
           ▼                                   ▼
   ┌────────────────┐                  ┌────────────────┐
   │ PostgreSQL     │◄─── persist ─────│ Redis (Upstash │
   │ (Neon)         │  (game finalize) │  / Railway)    │
   └────────────────┘                  └────────────────┘
```

- Postgres — долговременное состояние: пользователи, словари, история
  игр, результаты раундов. Используется обоими (Next.js и WS-сервер).
- Redis — горячее состояние онлайн-комнат: список игроков, чей ход,
  сколько секунд осталось, текущее слово, очередь слов. TTL 24ч.
- Socket.io сервер — отдельный Node-процесс на Railway. Не делает
  тяжёлых SQL-запросов в раунде; снапшотит игру в Postgres только при
  старте, между раундами и при `gameFinished`.

#### 2.1.2. Что переиспользовать из старого кода

| Старое                                   | Что делать                                       |
| ---------------------------------------- | ------------------------------------------------ |
| `prisma/schema.prisma`                   | расширить (см. §2.2), миграции с нуля            |
| `prisma/seed.ts`                         | переиспользовать как есть (категории/слова)      |
| `src/lib/utils.ts` (`cn`, `shuffleArray`)| переиспользовать                                 |
| `src/lib/prisma.ts`                      | переиспользовать                                 |
| `src/lib/session.ts`                     | заменить на `lib/identity.ts` (см. §2.6.4)       |
| `src/hooks/useTimer.ts`                  | оставить для локальной игры; для онлайна — server-driven|
| `src/components/ui/*` (Button, Card, Modal, Input, Switch, Badge, ScoreBoard, Timer, ErrorMessage) | переписать под design-tokens из `design/styles.css` (см. `DESIGN.md`) |
| `src/components/game/WordCard.tsx`       | переписать под новый дизайн (`.word-card`)       |
| `src/components/game/RoundSummary.tsx`   | переписать (`.word-row.got/.skip`)               |
| `src/components/game/TeamForm.tsx`       | переписать (`.team-card` + `--team-color`)       |
| `src/components/game/SettingsForm.tsx`   | переписать (`.cat-card`, `.chip`, `.toggle`)     |
| `src/components/game/WinnerBanner.tsx`   | переписать под Victory-screen из дизайна         |
| `src/components/game/GameHistory.tsx`    | переписать под `HistoryRow` из дизайна           |
| `src/app/api/categories/route.ts`        | переиспользовать                                 |
| `src/app/api/games/[id]/words/route.ts`  | переписать в helper, дёргается и из REST, и из WS|
| `src/app/api/games/route.ts`             | разделить на `/api/games` (локальные) и `/api/rooms` (онлайн) |
| `src/app/api/games/[id]/rounds/route.ts` | оставить только для локальной игры; для онлайна — внутри WS |
| `src/app/page.tsx`, `game/new`, `game/settings`, `game/[id]/turn`, `game/[id]/round`, `game/[id]/results` | переписать под новый дизайн и три режима |

Полностью **переписать**: вся UI-обёртка (стили), entry-flow, всё что
касается онлайна. Полностью **оставить**: логика подсчёта очков,
`shuffleArray`, seed-скрипт, идея "currentTeamIndex / currentRoundNumber".

#### 2.1.3. Структура папок

Монорепо с двумя сервисами и одним общим пакетом типов:

```
alias-online/
├── apps/
│   ├── web/                          # Next.js (Vercel)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                        # главная (mode select + history)
│   │   │   │   ├── globals.css                     # импорт design-tokens
│   │   │   │   ├── join/
│   │   │   │   │   └── page.tsx                    # ввод кода комнаты
│   │   │   │   ├── room/
│   │   │   │   │   └── [code]/
│   │   │   │   │       ├── page.tsx                # лобби онлайн (host+player view)
│   │   │   │   │       └── play/
│   │   │   │   │           └── page.tsx            # игровой экран онлайн
│   │   │   │   ├── local/
│   │   │   │   │   ├── new/page.tsx                # шаг 1: команды
│   │   │   │   │   ├── settings/page.tsx           # шаг 2: настройки
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── turn/page.tsx           # передайте устройство
│   │   │   │   │       ├── round/page.tsx          # игровой экран локальный
│   │   │   │   │       └── results/page.tsx
│   │   │   │   ├── results/
│   │   │   │   │   └── [gameId]/page.tsx           # общий экран результатов (online+local)
│   │   │   │   └── api/
│   │   │   │       ├── categories/route.ts         # GET
│   │   │   │       ├── games/                      # ЛОКАЛЬНЫЕ игры
│   │   │   │       │   ├── route.ts                # GET history, POST create local
│   │   │   │       │   └── [id]/
│   │   │   │       │       ├── route.ts            # GET, DELETE
│   │   │   │       │       ├── rounds/route.ts     # POST round (только local)
│   │   │   │       │       └── words/route.ts      # GET batch
│   │   │   │       └── rooms/                      # ОНЛАЙН-комнаты
│   │   │   │           ├── route.ts                # POST create room
│   │   │   │           └── [code]/
│   │   │   │               ├── route.ts            # GET snapshot, DELETE (host)
│   │   │   │               └── join/route.ts       # POST validate code → ws-token
│   │   │   ├── components/
│   │   │   │   ├── ui/                             # design-system, см. DESIGN.md
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   ├── Pill.tsx
│   │   │   │   │   ├── Toggle.tsx
│   │   │   │   │   ├── Chip.tsx
│   │   │   │   │   ├── Input.tsx
│   │   │   │   │   ├── Modal.tsx
│   │   │   │   │   ├── Avatar.tsx
│   │   │   │   │   ├── CodeChunk.tsx               # 6 цифр кода
│   │   │   │   │   ├── Stat.tsx
│   │   │   │   │   ├── Stepper.tsx                 # 1-2-3 индикатор
│   │   │   │   │   ├── DotsBg.tsx
│   │   │   │   │   ├── QRCode.tsx                  # обёртка над qrcode-lib
│   │   │   │   │   └── Header.tsx
│   │   │   │   ├── home/
│   │   │   │   │   ├── ModeCard.tsx                # офлайн / онлайн
│   │   │   │   │   └── HistoryRow.tsx
│   │   │   │   ├── setup/
│   │   │   │   │   ├── TeamCard.tsx
│   │   │   │   │   ├── TeamsEditor.tsx
│   │   │   │   │   ├── SettingsForm.tsx
│   │   │   │   │   └── CategoryGrid.tsx
│   │   │   │   ├── lobby/
│   │   │   │   │   ├── LobbyHostPanel.tsx          # код, QR, ссылка, кнопка Старт
│   │   │   │   │   ├── LobbyPlayerView.tsx         # вид присоединившегося
│   │   │   │   │   ├── TeamSlots.tsx               # drag-n-drop команды
│   │   │   │   │   └── SpectatorsList.tsx
│   │   │   │   ├── game/
│   │   │   │   │   ├── WordCard.tsx                # слово (для объясняющего)
│   │   │   │   │   ├── SpectatorCard.tsx           # «Ваня объясняет»
│   │   │   │   │   ├── ActionBar.tsx               # Пропуск / Угадал
│   │   │   │   │   ├── BigTimer.tsx
│   │   │   │   │   ├── PassDevicePanel.tsx         # для local
│   │   │   │   │   ├── PauseModal.tsx
│   │   │   │   │   └── RoundSummary.tsx
│   │   │   │   ├── results/
│   │   │   │   │   ├── VictoryHero.tsx
│   │   │   │   │   └── FinalStandings.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTimer.ts                     # клиентский, для local
│   │   │   │   ├── useServerTimer.ts               # подписка на server-tick
│   │   │   │   ├── useSocket.ts                    # singleton-сокет с авто-реконнектом
│   │   │   │   ├── useRoom.ts                      # стейт-машина комнаты
│   │   │   │   ├── useLocalStorage.ts
│   │   │   │   └── useClipboard.ts
│   │   │   ├── lib/
│   │   │   │   ├── prisma.ts
│   │   │   │   ├── identity.ts                     # userId/displayName в localStorage
│   │   │   │   ├── code.ts                         # генерация/валидация кода комнаты
│   │   │   │   ├── token.ts                        # подпись WS-токенов (HMAC)
│   │   │   │   ├── words.ts                        # выбор пакета слов (helper)
│   │   │   │   ├── socket-client.ts                # io(URL, options)
│   │   │   │   ├── api-client.ts
│   │   │   │   └── utils.ts                        # cn, shuffleArray, formatDate
│   │   │   ├── constants/
│   │   │   │   ├── game.ts                         # MIN_TEAMS, ROUND_TIME_OPTIONS, ...
│   │   │   │   └── theme.ts
│   │   │   └── styles/
│   │   │       └── tokens.css                      # из design/styles.css (vars). Импортируется из app/globals.css
│   │   ├── public/
│   │   │   └── sounds/timer-end.mp3
│   │   ├── tailwind.config.ts
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ws/                           # Socket.io сервер (Railway)
│       ├── src/
│       │   ├── index.ts                            # entry: HTTP healthcheck + io
│       │   ├── io.ts                               # io setup, middleware, namespaces
│       │   ├── auth.ts                             # проверка WS-токена
│       │   ├── redis.ts                            # ioredis client
│       │   ├── repositories/
│       │   │   ├── roomRepo.ts                     # все операции над комнатой в Redis
│       │   │   └── gameRepo.ts                     # snapshot в Postgres (Prisma)
│       │   ├── services/
│       │   │   ├── codeService.ts                  # generate/validate/free room code
│       │   │   ├── wordService.ts                  # пакет слов из Postgres
│       │   │   ├── scoreService.ts                 # подсчёт очков, проверка победы
│       │   │   ├── turnService.ts                  # next team / next player
│       │   │   └── timerService.ts                 # серверный таймер (setInterval per room)
│       │   ├── handlers/
│       │   │   ├── lobby.ts                        # join/leave/team-edit/start
│       │   │   └── round.ts                        # word_guess/skip/pause/end
│       │   ├── stateMachine.ts                     # см. §2.6.1
│       │   └── types.ts                            # копия SocketEvents (лучше из packages)
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/                       # общий TypeScript-пакет
│       ├── src/
│       │   ├── domain.ts                           # Game, Team, Player, Round...
│       │   ├── socket-events.ts                    # ClientEvents, ServerEvents
│       │   ├── api-contracts.ts                    # request/response REST
│       │   └── constants.ts                        # MIN_TEAMS, MAX_ROOM_PLAYERS, ROOM_TTL...
│       ├── package.json
│       └── tsconfig.json
├── prisma/                           # один schema на оба сервиса
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── .env.example
├── package.json                      # workspaces: apps/*, packages/*
├── pnpm-workspace.yaml               # (или npm workspaces)
├── turbo.json                        # (опц., но удобно)
└── README.md
```

---

### 2.2. БАЗА ДАННЫХ

#### 2.2.1. Полная Prisma-схема

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────── Словарь ───────────

model Category {
  id        Int            @id @default(autoincrement())
  name      String         @unique
  slug      String         @unique
  emoji     String?        // новое — иконка для UI
  isPublic  Boolean        @default(true)
  createdAt DateTime       @default(now())
  words     WordCategory[]
  games     GameCategory[]

  @@index([slug])
}

model Word {
  id         Int            @id @default(autoincrement())
  text       String         @unique
  difficulty Int            @default(1) // новое — 1..3 (легко/средне/сложно)
  createdAt  DateTime       @default(now())
  categories WordCategory[]
  roundWords RoundWord[]

  @@index([text])
}

model WordCategory {
  wordId     Int
  categoryId Int
  word       Word     @relation(fields: [wordId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([wordId, categoryId])
  @@index([categoryId])
}

// ─────────── Идентичность ───────────

// "User" в нашем мире = устройство+ник, без пароля.
// На клиенте генерируем userId один раз и кладём в localStorage.
// При желании потом подключим OAuth, не меняя схему.
model User {
  id          String   @id @default(cuid())
  displayName String
  avatarSeed  String?  // для генеративных аватарок (initials hash)
  createdAt   DateTime @default(now())

  hostedRooms  Room[]        @relation("RoomHost")
  participants Participant[]
  players      Player[]      // снимок игрока в конкретной игре (back-relation для Player.user)
}

// ─────────── Комнаты (ОНЛАЙН) ───────────

model Room {
  id        String      @id @default(cuid())
  code      String      @unique               // 6 символов A-Z0-9 без 0/O/1/I
  status    RoomStatus  @default(LOBBY)
  hostId    String
  host      User        @relation("RoomHost", fields: [hostId], references: [id])

  // настройки игры — фиксируются при старте
  roundTime   Int       @default(60)
  winScore    Int       @default(50)
  penaltySkip Boolean   @default(false)   // дефолт согласован с Game.penaltySkip

  isPublic  Boolean     @default(false)        // показывать в public-листе
  title     String?                            // "Пятничный созвон"

  createdAt DateTime    @default(now())
  startedAt DateTime?
  endedAt   DateTime?

  game      Game?                              // создаётся при старте
  participants Participant[]
  categories RoomCategory[]

  @@index([code])
  @@index([status])
}

enum RoomStatus {
  LOBBY      // ждём игроков
  IN_GAME    // идёт игра
  FINISHED   // окончена, можно посмотреть результаты
}

model RoomCategory {
  roomId     String
  categoryId Int
  room       Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([roomId, categoryId])
  @@index([roomId])
}

// Участник = User в конкретной Room. Может быть в команде или зрителем.
model Participant {
  id        String           @id @default(cuid())
  roomId    String
  userId    String
  role      ParticipantRole  @default(PLAYER)  // PLAYER | SPECTATOR
  teamId    Int?                                // null = в зрителях
  joinOrder Int                                 // для стабильного порядка
  joinedAt  DateTime         @default(now())
  leftAt    DateTime?

  room   Room  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user   User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  team   Team? @relation(fields: [teamId], references: [id], onDelete: SetNull)

  @@unique([roomId, userId])
  @@index([roomId])
}

enum ParticipantRole {
  PLAYER
  SPECTATOR
}

// ─────────── Игры ───────────

model Game {
  id                 String         @id @default(cuid())
  mode               GameMode                                       // LOCAL | ONLINE
  status             GameStatus     @default(IN_PROGRESS)
  ownerKey           String                                         // всегда userId (резолвится из cookie aid). В ONLINE = User.id хоста.

  roomId             String?        @unique                         // только для ONLINE
  room               Room?          @relation(fields: [roomId], references: [id], onDelete: SetNull)

  roundTime          Int            @default(60)
  winScore           Int            @default(50)
  penaltySkip        Boolean        @default(false)
  currentTeamIndex   Int            @default(0)
  currentRoundNumber Int            @default(1)
  usedWordIds        Int[]          @default([])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  finishedAt DateTime?

  teams          Team[]
  rounds         Round[]
  gameCategories GameCategory[]

  @@index([ownerKey])
  @@index([status])
}

enum GameMode {
  LOCAL
  ONLINE
}

enum GameStatus {
  IN_PROGRESS
  FINISHED
}

model GameCategory {
  gameId     String
  categoryId Int
  game       Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([gameId, categoryId])
  @@index([gameId])
}

model Team {
  id                 Int      @id @default(autoincrement())
  gameId             String
  name               String
  color              String   // "team-1".."team-6"
  score              Int      @default(0)
  order              Int
  currentPlayerIndex Int      @default(0)

  game         Game          @relation(fields: [gameId], references: [id], onDelete: Cascade)
  players      Player[]
  rounds       Round[]
  participants Participant[]

  @@index([gameId])
}

// Player — снимок игрока на момент старта игры (имя + опц. ссылка на User).
// В LOCAL-режиме userId всегда null.
// В ONLINE-режиме userId есть, но Player всё равно живёт независимо
// (если игрок отвалился — место в очереди сохраняется).
model Player {
  id     Int     @id @default(autoincrement())
  teamId Int
  userId String?
  name   String
  order  Int

  team Team  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([teamId])
}

model Round {
  id          Int       @id @default(autoincrement())
  gameId      String
  teamId      Int
  roundNumber Int
  playerName  String                  // снимок имени, чтобы было видно даже если Player удалят
  scoreEarned Int       @default(0)
  startedAt   DateTime  @default(now())  // ЗАМЕНЯЕТ старое createdAt: используется и как timestamp для сортировки истории, и как момент старта раунда
  endedAt     DateTime?                  // null пока раунд активен

  game  Game        @relation(fields: [gameId], references: [id], onDelete: Cascade)
  team  Team        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  words RoundWord[]

  @@index([gameId])
  @@index([teamId])
}

model RoundWord {
  id      Int     @id @default(autoincrement())
  roundId Int
  wordId  Int
  guessed Boolean
  order   Int     @default(0)         // порядок показа слова в раунде

  round Round @relation(fields: [roundId], references: [id], onDelete: Cascade)
  word  Word  @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@index([roundId])
  @@index([wordId])
}
```

#### 2.2.2. Что меняется vs текущая схема — и почему

| Изменение | Зачем |
| --- | --- |
| Новая модель **`User`** | онлайн-режим: каждый игрок — отдельный «человек+устройство», нужен стабильный id для реконнекта |
| Новая модель **`Room`** + enum `RoomStatus` | контейнер для онлайн-партии: код, хост, статус LOBBY/IN_GAME/FINISHED |
| Новая модель **`Participant`** + enum `ParticipantRole` | связь User↔Room, поддержка зрителей и переключения команд в лобби |
| **`Game.mode`** (LOCAL/ONLINE) | один и тот же тип игры обслуживает оба режима |
| **`Game.roomId`** (nullable, unique) | онлайн-игра привязана к комнате, локальная — нет |
| Поле **`ownerKey`** вместо `sessionId` | теперь всегда userId (из cookie `aid`); один индекс на оба сценария, единая модель идентификации |
| **`Team.color`** | в текущем коде цвет берётся из `TEAM_COLORS` по индексу — теперь сохраняем явно (важно для онлайна, где команд может быть до 6 и порядок меняется) |
| **`Player.userId`** (nullable) | связывает игрока с конкретным `User` в онлайн-режиме |
| **`Round.startedAt` / `Round.endedAt`** | для аналитики и для server-driven таймера (время реально потраченное) |
| **`RoundWord.order`** | сохраняем порядок слов, чтобы корректно показать «итоги раунда» |
| **`Word.difficulty`**, **`Category.emoji`**, **`Category.isPublic`** | расширения под новый дизайн (эмодзи на карточках категорий, фильтр) |
| Удалено поле `Game.sessionId` (заменено на `ownerKey: User.id`) | унификация: одно поле на LOCAL и ONLINE |

Миграции: с нуля (`prisma migrate reset`), потому что сильно меняется
семантика. Сид-скрипт расширяется: проставить `emoji` категорям и
дефолтную `difficulty=1` всем словам.

#### 2.2.3. Что в Postgres, что в Redis

**Postgres** (Source of Truth):
- `User`, `Category`, `Word`, `WordCategory`
- `Game`, `Team`, `Player`, `Round`, `RoundWord`, `GameCategory` — всё, что
  должно остаться в истории
- `Room` (метаданные комнаты), `Participant` (для истории «кто играл»)

**Redis** (горячий кеш онлайн-комнаты, TTL 24ч):
- `room:<code>` — JSON-снимок комнаты (см. §2.6.5)
- `room:<code>:lock` — короткий lock для атомарных переходов (через
  redlock или просто `SET NX EX`)
- `room:<code>:words` — очередь слов, оставшаяся в раунде
- `room:<code>:timer` — `{ startedAt, durationMs, paused, pausedAt }`
- `code:<CODE>` → `roomId` — обратная индексация по коду
- `user:<userId>:rooms` — set комнат, в которых юзер сейчас активен (для
  показа на главной «вернуться в игру»)

Всё в Redis может пропасть → восстанавливается частично из Postgres
(до последнего снепшота между раундами).

---

### 2.3. API ENDPOINTS (REST, Next.js)

> Везде JSON. Ошибки: `{ error: string, code?: string }` + HTTP-статус.
> Идентификация устройства — **только** через httpOnly-cookie `aid`
> (anonymous-id), которая проставляется next-middleware'ом на первом
> запросе. Никаких `sessionId` в body/query — это сознательно. На сервере
> userId резолвится из cookie, и там же на лету при необходимости
> создаётся запись в `User` (см. §2.6.4). Хосту дополнительно — claim,
> что он `host`, через подпись WS-токена.

#### 2.3.1. Категории

**`GET /api/categories`**
- 200 → `Category[]` с `_count.words`, `emoji`, `slug`.

#### 2.3.2. Локальные игры

> Во всех LOCAL-эндпоинтах ниже владелец игры определяется как
> `Game.ownerKey === userId(cookie aid)`. На несовпадение отвечаем 403.

**`POST /api/games`** — создать локальную игру.
- body:
  ```ts
  {
    settings: { roundTime: number, winScore: number, penaltySkip: boolean, categoryIds: number[] },
    teams: { name: string, players: { name: string }[] }[]
  }
  ```
- На сервере: `ownerKey = userId(cookie aid)`.
- 201 → `Game` (со связями), `mode = LOCAL`.

**`GET /api/games`** — история локальных игр устройства (фильтр по cookie `aid`).
- 200 → `Game[]`.

**`GET /api/games/[id]?includeRounds=true`** — снимок локальной игры.
- 200 → `Game | GameWithRounds`. 403 если `ownerKey !== userId(cookie)`.

**`PATCH /api/games/[id]`** — изменить настройки IN_PROGRESS-игры (опц.). 403 если не владелец.

**`DELETE /api/games/[id]`** — удалить. 403 если не владелец.

**`GET /api/games/[id]/words`** — пакет неиспользованных слов.
- 200 → `{ id: number, text: string }[]` (BATCH=50 по умолчанию). 403 если не владелец.

**`POST /api/games/[id]/rounds`** — финализировать раунд.
- body:
  ```ts
  {
    teamId: number,
    playerName: string,
    words: { wordId: number, guessed: boolean, order: number }[]
  }
  ```
- 403 если `Game.ownerKey !== userId(cookie aid)`.
- 200 →
  ```ts
  {
    round: { id, roundNumber, scoreEarned },
    teamScore: number,
    nextTeamIndex: number,
    nextRoundNumber: number,
    gameFinished: boolean,
    winnerId?: number
  }
  ```

#### 2.3.3. Онлайн-комнаты

**`POST /api/rooms`** — создать комнату.
- body:
  ```ts
  {
    hostName: string,                 // ник хоста
    title?: string,
    isPublic?: boolean,
    settings: { roundTime: number, winScore: number, penaltySkip: boolean, categoryIds: number[] }
  }
  ```
- Поведение:
  1. Создаёт `User` (если cookie `aid` пустая), записывает userId в cookie.
  2. Создаёт `Room` со статусом `LOBBY`, генерит уникальный `code`.
  3. Кладёт стартовый снимок в Redis (`room:<code>`).
  4. Возвращает токен для подключения к WS.
- 201 →
  ```ts
  {
    room: { code, hostId, title, settings },
    user: { id, displayName },
    wsUrl: string,
    wsToken: string                  // HMAC-подпись (userId, roomCode, role=host, exp)
  }
  ```

**`POST /api/rooms/[code]/join`** — войти в существующую комнату.
- body: `{ displayName: string }`
- Поведение: создаёт/обновляет User, возвращает WS-токен `role=player`.
- 200 →
  ```ts
  {
    room: { code, title, hostName, settings, status, playersCount },
    user: { id, displayName },
    wsUrl: string,
    wsToken: string
  }
  ```
- 404 если код не найден; 410 если комната `FINISHED`; 409 если уже
  `IN_GAME` (в v2 join после старта запрещён; флаг allowJoinAfterStart —
  вне scope).

**`GET /api/rooms/[code]`** — снимок комнаты для прероллов / SSR-страницы.
- 200 → `RoomSnapshot` (см. §2.6.5).

**`DELETE /api/rooms/[code]`** — закрыть комнату (только хост; через токен).
- 204.

**`GET /api/rooms/public`** — (опц., для блока «Идёт прямо сейчас»).
- 200 → `RoomCard[]` с `code`, `title`, `playersCount`, `host`.

#### 2.3.4. Идентификация

**`GET /api/me`** — текущий «User» (по cookie `aid`).
- 200 → `{ id, displayName }` или 204 если не созданo.

**`PATCH /api/me`** — изменить `displayName`.

> Все REST-эндпоинты, которые вызываются с фронта, кодом разделяются на
> «public» (categories, public rooms) и «owner-bound» (rest). Идентификация
> устройства — единообразно через cookie `aid` (см. §2.6.4), без
> `sessionId` в payload'ах. Хосту WS-сервер не доверяет cookie напрямую —
> он верит подписанному WS-токену, выданному REST-эндпоинтом.

---

### 2.4. WEBSOCKET СОБЫТИЯ (Socket.io, namespace `/room`)

#### 2.4.1. Подключение

Клиент:
```ts
io(`${WS_URL}/room`, { auth: { token: wsToken, code: roomCode } })
```

Middleware на сервере: валидирует HMAC-токен → достаёт `userId, roomCode,
role`. Иначе `disconnect`. После успеха — `socket.join('room:'+code)`.

#### 2.4.2. Общая структура

Все события строго типизированы (см. `packages/shared/socket-events.ts`).

Алиасы:
- `Phase` = `'LOBBY' | 'PRE_ROUND' | 'ROUND_ACTIVE' | 'ROUND_REVIEW' | 'BETWEEN_ROUNDS' | 'FINISHED'`
- `RoomSnapshot` = смотри §2.6.5

Префиксы:
- `room:*` — про лобби и общее состояние
- `team:*` — управление составом
- `round:*` — игровой цикл

#### 2.4.3. Client → Server

| Событие | Кто шлёт | Когда (фаза) | Payload | Ответ (ack) |
| --- | --- | --- | --- | --- |
| `room:hello` | любой клиент | сразу после connect | `{}` | `RoomSnapshot` |
| `room:rename` | host | LOBBY | `{ title: string }` | `{ ok: true }` |
| `room:settings_update` | host | LOBBY | `Partial<{roundTime, winScore, penaltySkip, categoryIds}>` | `{ ok }` |
| `room:close` | host | любая | `{}` | `{ ok }` |
| `team:create` | host | LOBBY | `{ name?: string, color?: string }` | `{ teamId: number }` |
| `team:rename` | host | LOBBY | `{ teamId, name }` | `{ ok }` |
| `team:remove` | host | LOBBY | `{ teamId }` | `{ ok }` |
| `team:join` | player | LOBBY | `{ teamId: number \| null }` (`null` = в зрители) | `{ ok }` |
| `team:reorder_player` | host | LOBBY | `{ teamId, playerIds: string[] }` (новый порядок) | `{ ok }` |
| `team:shuffle` | host | LOBBY | `{}` | `{ ok }` |
| `round:start_game` | host | LOBBY | `{}` | `{ ok }` или `{ error }` |
| `round:start` | host (или авто после `PRE_ROUND` countdown) | PRE_ROUND | `{}` | `{ ok }` |
| `round:guess` | explainer | ROUND_ACTIVE | `{ wordId: number, guessed: boolean }` | `{ nextWord?: { id, text } \| null }` |
| `round:pause` | host or explainer | ROUND_ACTIVE | `{}` | `{ ok }` |
| `round:resume` | host or explainer | ROUND_ACTIVE (paused) | `{}` | `{ ok }` |
| `round:end` | host or explainer | ROUND_ACTIVE | `{ confirm: true }` | `{ ok }` (UI обязан показать confirmation modal перед отправкой) |
| `round:review_toggle` | explainer | ROUND_REVIEW | `{ wordId: number }` (перевернуть статус) | `{ ok }` |
| `round:review_confirm` | explainer | ROUND_REVIEW | `{}` | `{ ok }` |
| `room:leave` | любой | любая | `{}` | — |

Все эндпоинты, доступные только хосту, возвращают `{ error: 'forbidden' }` если шлёт не хост.

#### 2.4.4. Server → Client (бродкасты)

| Событие | Когда летит | Payload |
| --- | --- | --- |
| `room:state` | после любых изменений (debounce 50ms) | `RoomSnapshot` |
| `room:player_joined` | новый игрок подключился | `{ user: { id, displayName }, role }` |
| `room:player_left` | отключение | `{ userId }` |
| `room:player_online` | реконнект | `{ userId, online: boolean }` |
| `room:closed` | хост закрыл | `{ reason: 'host_left' \| 'manual' }` |
| `round:phase` | при смене фазы | `{ phase: Phase, roundNumber, currentTeamId, currentPlayerId, durationMs? }` |
| `round:countdown` | PRE_ROUND, каждую секунду 3-2-1 | `{ secondsLeft: number }` |
| `round:tick` | ROUND_ACTIVE, каждую секунду (1000мс) | `{ msLeft: number }` |
| `round:word` | смена слова (только explainer) | `{ wordId, text, index, total }` |
| `round:word_count` | угадал/пропустил (всем) | `{ got: number, skip: number, msLeft: number }` |
| `round:review` | переход в ROUND_REVIEW | `{ words: { wordId, text, guessed, order }[], teamId, scorePreview }` |
| `round:committed` | подтверждено | `{ teamId, scoreEarned, teamScore, nextTeamId, nextRoundNumber, gameFinished, winnerTeamId? }` |
| `error` | ошибка | `{ code, message }` |

Особое поведение:
- `round:word` приходит **только** explainer'у (private emit). Все остальные
  получают `round:word_count` для счётчиков.
- В `RoundReview` `round:review` шлётся всем игрокам команды explainer'а
  (чтобы команда видела таблицу), а право редактировать — только у
  explainer'а.

#### 2.4.5. Соответствие фаз и событий

| Phase | Что инициирует переход | Server-emit |
| --- | --- | --- |
| `LOBBY` | `round:start_game` от хоста | → `round:phase{PRE_ROUND}` |
| `PRE_ROUND` | по таймеру (3 секунды) | `round:countdown{3..0}` → `round:phase{ROUND_ACTIVE}` + первый `round:word` |
| `ROUND_ACTIVE` | таймер истёк ИЛИ `round:end` ИЛИ `round:guess` всех слов | → `round:phase{ROUND_REVIEW}` + `round:review` |
| `ROUND_REVIEW` | `round:review_confirm` от explainer'а | → коммит в Postgres → `round:committed` → `round:phase{BETWEEN_ROUNDS}` |
| `BETWEEN_ROUNDS` | через 4 сек или `round:start` | → `round:phase{PRE_ROUND}` следующего раунда |
| `FINISHED` | при `gameFinished=true` | → `round:phase{FINISHED}` + `room:state` (со счётом) |

Пауза: переход не меняет фазу, но `round:tick` останавливается, ставится
`paused=true` в снапшоте.

---

### 2.5. UI/UX FLOW

> Все экраны строятся по дизайну из `design/` (см. `DESIGN.md`).
> Цветовая система — design tokens (`--bg`, `--accent`, `--team-1..6`).
> Тёмная тема по умолчанию, переключаемая.

#### 2.5.1. Карта экранов

```
                          ┌─────────────────────────┐
                          │ /  HOME                 │
                          │ - mode: online|offline  │
                          │ - history list          │
                          └──┬──────────────┬───────┘
                             │              │
        online:Создать       │              │ offline:Новая игра
        online:Войти по коду │              │
                             ▼              ▼
                ┌────────────────────┐   ┌────────────────────┐
                │ /room/[code]       │   │ /local/new         │
                │ LOBBY (host/player)│   │ Команды (Step 1)   │
                └──────┬─────────────┘   └─────────┬──────────┘
                       │                           │
                       │ host: Старт               │
                       ▼                           ▼
                ┌──────────────────┐       ┌────────────────────┐
                │ /room/[code]/play│       │ /local/settings    │
                │ ИГРА (online)    │       │ Настройки (Step 2) │
                │ - explainer view │       └─────────┬──────────┘
                │ - guesser view   │                 │
                │ - spectator view │                 ▼
                └──────┬───────────┘       ┌────────────────────┐
                       │                   │ /local/[id]/turn   │
                       │                   │ Передать устройство│
                       │                   └─────────┬──────────┘
                       │                             │
                       │                             ▼
                       │                   ┌────────────────────┐
                       │                   │ /local/[id]/round  │
                       │                   │ Игра (1 устройство)│
                       │                   └─────────┬──────────┘
                       │                             │
                       │   game finished             │
                       ▼                             ▼
                ┌────────────────────────────────────────────┐
                │ /results/[gameId]                          │
                │ Победа + финальный счёт + Реванш / Главная │
                └────────────────────────────────────────────┘

Дополнительно:
  /join                 — экран ввода кода (mobile-friendly)
```

#### 2.5.2. Описание экранов

##### A. Главная `/`
- Хедер: лого, переключатель темы, RU/EN.
- Hero: заголовок «Объясняй. Угадывай. Побеждай.», подпись.
- **Mode toggle** — две большие карточки `ModeCard`:
  - «Онлайн» — описание + список фич
  - «На одном устройстве»
- Primary CTA меняется в зависимости от выбранного mode:
  - online: `[Создать комнату]` + `[Войти по коду]`
  - offline: `[Новая игра]`
- Strip статистики (по своим играм): «42 игр», «1 284 слов», «68% успеха».
- Список «История игр» (`HistoryRow`): и LOCAL, и ONLINE; для незавершённых
  ONLINE-игр кнопка «Продолжить» ведёт в `/room/[code]`, для LOCAL — в
  соответствующий route.

##### B. Ввод кода `/join`
- Большие 6 ячеек кода (`CodeChunk lg`).
- Поле «Ваш ник» (prefill из `localStorage.displayName`).
- Кнопка «Войти в комнату» → POST `/api/rooms/[code]/join` → редирект
  `/room/[code]`.
- Линк «На главную».

##### C. Локальный setup `/local/new` → `/local/settings`
- `/local/new`: Stepper(1/3), список карточек команд (`TeamCard`), drag-n-drop
  игроков между командами, кнопка «Дальше».
- `/local/settings`: Stepper(2/3), время раунда (chips), очки (chips),
  toggle штрафа, grid категорий (`CategoryGrid`), кнопка «Начать игру»
  → POST `/api/games` → редирект `/local/[id]/turn`.

##### D. Передача устройства `/local/[id]/turn`
- Eyebrow: «РАУНД N · КОМАНДА «X»».
- Большая heading «Передайте устройство».
- Карточка `PassDevicePanel` (avatar + «Ваня объясняет»).
- Pills с очками команд.
- Большая primary-кнопка «Старт раунда» → `/local/[id]/round`.

##### E. Локальная игра `/local/[id]/round`
- Минимальный хедер (pill команды + раунд + счёт +/- + pause).
- BigTimer (mono 88px) + thin progress.
- `WordCard` (большая карта с словом).
- ActionBar внизу: «Пропуск» (red) / «Угадал» (green).
- При окончании таймера: модалка `RoundSummary` (список слов с
  возможностью переключить статус, итог, кнопка «Подтвердить»).
- Pause-modal: «Продолжить» / «Завершить раунд».

##### F. Лобби `/room/[code]`
Two-column на desktop, single-column mobile.

**Левая колонка (общая для всех):**
- Eyebrow: «ONLINE LOBBY · WAITING ROOM».
- Title: `room.title || 'Игра без названия'`.
- Подпись: `Хост: Ваня · 5 игроков, 2 зрителя`.
- Блок **«Команды»**: grid `TeamCard`'ов.
  - Каждая карточка — `--team-color`, имя редактируемое (только хост),
    список слотов с avatar + ник + crown (хост) + индикатор online.
  - Слот «Свободно» — кликом текущий пользователь переходит в эту команду.
  - Кнопка «Создать команду» (только хост, до 6).
- Блок **«Зрители»**.

**Правая колонка (host panel):**
- Карточка с **`КОДОМ КОМНАТЫ`** (CodeChunk lg) + кнопки `[Копировать код]`, `[Копировать ссылку]` + QR + ссылка.
- Карточка с настройками (read-only краткий пересказ): «Время раунда / Очки / Категорий N / X слов в банке», кнопка «Изменить настройки» (открывает модалку с `SettingsForm` — только хост).
- Большая `[Начать игру]` (disabled пока не выполнены условия).
- Под ней live-индикатор «Ждём ещё одного игрока» / «Все готовы».

**View игрока (не хост):**
- Та же левая колонка.
- Правая колонка свёрнута: карточка «Хост скоро начнёт игру», pulse, и
  pill `Code: VPYZQQ` (для информации).

##### G. Игра онлайн `/room/[code]/play`
**Минимальный хедер:**
- Pill команды explainer'а + pill `LIVE`.
- В центре: «РАУНД N».
- Справа: счётчики `+5 / -2` (got/skip), кнопка пауза (только host/explainer).

**Центр (зависит от роли):**
- **explainer** — `WordCard` с самим словом, ActionBar внизу
  (`Пропуск` / `Угадал`).
- **guesser** (его команда сейчас угадывает) — `SpectatorCard` с
  eyebrow «ВЫ УГАДЫВАЕТЕ» + «Ваня объясняет».
- **spectator / other-team** — **точно тот же** `SpectatorCard` с
  «Ваня объясняет», единственное отличие — eyebrow «ВЫ СМОТРИТЕ».
  Никаких функциональных различий: ни реакций, ни доп. действий.

Большой Timer везде один и тот же (server-driven). Pause-модалка — у
хоста и у explainer'а.

После окончания раунда — у explainer'а появляется `RoundSummary` (как в
local), у остальных — read-only вид этого summary («Команда X подтверждает
итоги…»). После `round:committed` — короткая `BETWEEN_ROUNDS` (4 сек) с
анонсом «Следующий: команда Y, объясняет Z», и автоматический переход в
PRE_ROUND.

##### H. Результаты `/results/[gameId]`
- VictoryHero: иконка трофея, «Победа!», pill команды-победителя.
- FinalStandings: список команд с местами, очками, цветом.
- Кнопки `[Реванш]` (создаёт новую игру с тем же составом) и `[На главную]`.

#### 2.5.3. Чем экран хоста отличается от экрана игрока (онлайн)

| Элемент | Хост | Игрок | Зритель |
| --- | --- | --- | --- |
| Право редактировать настройки в лобби | да | нет | нет |
| Создавать/удалять команды | да | нет | нет |
| Кнопка «Начать игру» | да | нет | нет |
| `WordCard` со словом | да, если он же explainer | да, если он же explainer | никогда |
| Pause | да всегда | только если explainer | нет |
| Action bar (`Пропуск`/`Угадал`) | только если explainer | только если explainer | нет |
| RoundSummary с правом изменения | только если explainer | только если explainer | read-only |
| Закрыть комнату | да | нет | нет |

> Зритель (`spectator`) функционально идентичен «другой команде»
> (`guesser` не из текущей команды): один и тот же `SpectatorCard`, один и
> тот же тайминг, никаких приватных действий. Разница — только в eyebrow
> карточки («ВЫ СМОТРИТЕ» vs «ВЫ УГАДЫВАЕТЕ»).

#### 2.5.4. Чем онлайн отличается от локального на уровне UI

- В локальном режиме нет сокетов, нет pre-round countdown, нет
  «отделять explainer от остальных» — слово видно всем на одном экране.
- В локальном — экран `/turn` (передача устройства) перед каждым раундом.
  В онлайне его нет (передача устройства — это бессмыслица).
- В локальном таймер клиентский (`useTimer`); в онлайне — серверный
  (`useServerTimer`, ticks через WS).
- Лобби есть только в онлайне.
- В онлайне есть индикаторы online/offline у игроков и авто-reconnect.
  Реакции в v2 отсечены (см. §2.7).
- В обоих режимах `Game.ownerKey = userId` (резолвится из cookie `aid`,
  см. §2.6.4); в онлайне дополнительно — `roomId` и привязка к `Room.hostId`.

---

### 2.6. ИГРОВАЯ ЛОГИКА

#### 2.6.1. State machine (online room)

```
                ┌─────────────┐
                │   LOBBY     │  ← создана комната, игроки входят
                └──────┬──────┘
            host:start_game │ (валидация: ≥2 команды, в каждой ≥2 игрока)
                            ▼
                ┌─────────────┐
                │  PRE_ROUND  │  таймер 3 сек, countdown всем
                └──────┬──────┘
                       │ автоматически
                       ▼
                ┌─────────────┐
                │ROUND_ACTIVE │  серверный таймер, слова, угадал/пропуск
                └──────┬──────┘
       timer == 0 OR end OR words exhausted
                       ▼
                ┌─────────────┐
                │ROUND_REVIEW │  explainer правит, видит итоги
                └──────┬──────┘
       explainer:confirm │  → commit Round в Postgres
                         ▼
                ┌──────────────┐
                │BETWEEN_ROUNDS│  4 сек, анонс след. команды
                └──────┬───────┘
       gameFinished?     │
              ┌──────────┴──────────┐
              │ no                  │ yes
              ▼                     ▼
        PRE_ROUND               FINISHED
        (next team)             (терминальное)
```

Условия валидности `LOBBY → PRE_ROUND`:
- ≥2 команды,
- в каждой команде ≥2 **онлайн** игрока на момент нажатия `Старт игры`
  (offline-игроки не считаются и автоматически переводятся в зрители при
  старте: `Participant.teamId = null, role = SPECTATOR`),
- хост может быть в любой команде или в зрителях.

Side-effects на каждом переходе:
- `LOBBY → PRE_ROUND`: создаём `Game` в Postgres, создаём `Team` и `Player`
  (snapshot Participant'ов с `online=true`), сохраняем `Game.id` в
  `room.gameId` (Redis + Postgres `Room.game`).
- `PRE_ROUND → ROUND_ACTIVE`: вытаскиваем пакет слов (50 шт.) для команды,
  кладём в Redis-очередь, отправляем первое слово приватно explainer'у,
  запускаем серверный setInterval(1000ms) → `round:tick`.
- `ROUND_ACTIVE → ROUND_REVIEW`: останавливаем интервал, формируем
  `words[]` со статусами, шлём `round:review`.
- `ROUND_REVIEW → BETWEEN_ROUNDS`: транзакция `Round + RoundWord[] + Team.score
  + Game.{currentTeamIndex,currentRoundNumber,usedWordIds}` (как в
  текущем `app/api/games/[id]/rounds/route.ts`).
- `BETWEEN_ROUNDS → PRE_ROUND | FINISHED`: проверка победы (как сейчас, в
  конце цикла команд: если кто-то ≥ winScore, выбираем макс).
- `→ FINISHED`: `Room.status=FINISHED`, `Game.status=FINISHED`,
  `Game.finishedAt=now`. Redis-ключи получают TTL 1ч (на случай если кто-то
  обновит страницу).

#### 2.6.2. State machine (local game)

Гораздо проще — никакого PRE_ROUND/REVIEW по сети, всё клиентское:

```
   /turn  ──[Старт]──▶  /round (timer running)
                              │
              timer==0 OR Завершить раунд
                              │
                              ▼
                    Modal RoundSummary (правка)
                              │
                       [Подтвердить]
                              │
                  POST /api/games/[id]/rounds
                              │
              gameFinished? ─yes──▶ /results
                    │ no
                    ▼
                  /turn (next team)
```

#### 2.6.3. Алгоритмы

**Подсчёт очков за раунд** (общий для local и online, в `scoreService`):
```ts
score = guessedCount - (penaltySkip ? skippedCount : 0)
teamScore = max(0, currentTeamScore + score)
```

**Выбор следующей команды/игрока** (`turnService`):
```ts
nextTeamIndex = (currentTeamIndex + 1) % teams.length
nextRoundNumber = nextTeamIndex === 0 ? currentRoundNumber + 1 : currentRoundNumber
team.currentPlayerIndex = (team.currentPlayerIndex + 1) % team.players.length
```

**Проверка победы** (только в конце цикла команд, `nextTeamIndex === 0`,
если `winScore > 0`):
```ts
qualified = teams.filter(t => t.score >= winScore)
if qualified.length > 0:
   winner = argmax(qualified, t.score)
   gameFinished = true
```

(Логика идентична текущему `rounds/route.ts`.)

**Выбор слов** (`wordService.fetchBatch(gameId, n=50)`):
```sql
SELECT w.id, w.text FROM Word w
WHERE w.id IN (SELECT wordId FROM WordCategory WHERE categoryId IN ($categoryIds))
  AND NOT EXISTS (
    SELECT 1 FROM RoundWord rw JOIN Round r ON rw.roundId = r.id
    WHERE r.gameId = $gameId AND rw.wordId = w.id
  )
ORDER BY random()  -- либо shuffle на бэке
LIMIT $n
```

В онлайне дополнительно вычитаем уже отданные в текущий раунд (хранится в
Redis-очереди), чтобы при реконнекте не выдать дубль.

**Генерация кода комнаты** (`codeService.generateUniqueCode`):
- алфавит 32 символа: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (без 0/O/1/I/Z·опц)
- 6 символов
- цикл: сгенерировать → проверить `EXISTS code:<CODE>` в Redis и `Room.code` в
  Postgres → если есть, повторить (max 5 попыток).

#### 2.6.4. Идентификация устройства

- При первом запросе на любой API endpoint Next.js middleware проверяет
  cookie `aid`. Если её нет — генерирует cuid, ставит cookie (httpOnly,
  SameSite=Lax, Path=/, 1 год).
- В localStorage отдельно дублируется `displayName` (для prefill полей).
- WS-подключение делается с токеном, сгенерированным REST-эндпоинтом, в
  payload токена: `{ userId, roomCode, role: 'host'|'player', exp }`,
  подпись HMAC секретом из `process.env.WS_TOKEN_SECRET`.

#### 2.6.5. RoomSnapshot (то, что лежит в Redis и шлётся в `room:state`)

```ts
type RoomSnapshot = {
  code: string
  title: string | null
  status: RoomStatus
  hostId: string
  settings: { roundTime: number; winScore: number; penaltySkip: boolean; categoryIds: number[] }
  phase: Phase
  currentTeamId: number | null
  currentPlayerId: string | null      // userId объясняющего; зафиксирован на весь раунд (см. §2.6.6)
  currentRoundNumber: number
  teams: {
    id: number
    name: string
    color: string
    score: number
    players: { userId: string; displayName: string; online: boolean; order: number }[]
  }[]
  spectators: { userId: string; displayName: string; online: boolean }[]
  timer: { msLeft: number; paused: boolean } | null
  scoreboard: { teamId: number; got: number; skip: number } | null   // для текущего раунда
  gameId: string | null
}
```

Это «view-модель», на её основе UI рендерит и хост, и player, и spectator.
Серверный код держит её в Redis как один JSON, обновляет в одном месте,
рассылает после каждого изменения. Слово, которое видит explainer, в
снапшот **не входит** — оно отправляется отдельным private-event'ом.

#### 2.6.6. Reconnect

- Клиент хранит `wsToken` в `sessionStorage` (живёт пока вкладка открыта).
- При коротком обрыве `socket.io` сам reconnect'ит. На сервере middleware
  принимает тот же токен, ищет `Participant` по `(roomCode, userId)`,
  помечает `online=true`, шлёт `room:player_online`.
- Если `sessionStorage` очистилась (закрытие вкладки / новый таб):
  - игрок: повторно дёргает `POST /api/rooms/[code]/join` (cookie `aid`
    тот же → User тот же → Participant находится по `(roomCode, userId)`
    и переоткрывается, `leftAt` обнуляется);
  - хост: дёргает `GET /api/rooms/[code]` — REST по cookie `aid` видит,
    что `Room.hostId === userId`, и выдаёт новый `wsToken` с `role=host`.
- Привязка explainer'а — на весь раунд по `userId`. Если оригинальный
  explainer dropped в фазе `ROUND_ACTIVE`:
  - таймер продолжает идти (паузу инициирует только сам explainer/host
    вручную);
  - при реконнекте того же `userId` сервер пере-эмитит ему `round:word`
    с текущим словом и текущим прогрессом;
  - если он не вернулся за `EXPLAINER_DROP_TIMEOUT_MS` (по умолчанию 30
    сек) — host получает алерт-toast и кнопку «Завершить раунд досрочно»
    (это `round:end { confirm: true }` с подтверждением в модалке).
- Полная замена explainer'а (другой игрок «подменяет») в v2 не
  поддерживается: explainer привязан к userId до конца раунда.

#### 2.6.7. Константы (источник истины)

Эти числа фигурируют сразу в нескольких местах (UI, валидация, дизайн).
Чтобы не разъезжались — фиксируем здесь, а во всех остальных файлах
(включая `apps/web/src/constants/game.ts` и `packages/shared/constants.ts`)
используем одни и те же значения.

```ts
// packages/shared/constants.ts
export const MIN_TEAMS = 2
export const MAX_TEAMS = 6                  // в v1 было 4, в v2 расширили
export const MIN_PLAYERS_PER_TEAM = 2
export const MAX_PLAYERS_PER_TEAM = 6       // унифицировано (в v1 было 6, в дизайне было 8 — берём 6)

export const ROUND_TIME_OPTIONS = [30, 45, 60, 90, 120] as const   // секунды
export const WIN_SCORE_OPTIONS  = [25, 50, 75, 100] as const        // 150 убран — расходился с кодом
export const ROUND_TIME_DEFAULT = 60
export const WIN_SCORE_DEFAULT  = 50
export const PENALTY_SKIP_DEFAULT = false   // совпадает с Game/Room @default(false)

export const WORDS_BATCH_SIZE = 50
export const TIMER_WARNING_SECONDS = 5

export const MAX_ROOM_PLAYERS = MAX_TEAMS * MAX_PLAYERS_PER_TEAM // 36
export const ROOM_TTL_SECONDS = 60 * 60 * 24                     // 24h в Redis
export const EXPLAINER_DROP_TIMEOUT_MS = 30_000                  // см. §2.6.6
```

`DESIGN.md` и `CURRENT_CODE.md` приведены к этим же значениям.

#### 2.6.8. Что хранится в Postgres vs Redis (резюме)

| Сущность | Postgres | Redis |
| --- | --- | --- |
| Категории, слова | ✓ | — |
| Готовая история игр | ✓ | — |
| `Room` (метаданные) | ✓ | — |
| `Participant` (история «кто играл») | ✓ (создаётся при join, обновляется `leftAt`) | — |
| `Game`, `Team`, `Player` | ✓ (создаются при `LOBBY → PRE_ROUND`) | snapshot в `room:<code>` |
| `Round`, `RoundWord` | ✓ (commit на `ROUND_REVIEW → BETWEEN_ROUNDS`) | временный список в `room:<code>:current_round` |
| Текущая фаза, msLeft, current word index | — | ✓ (`room:<code>`, `room:<code>:timer`) |
| Очередь оставшихся слов раунда | — | ✓ (`room:<code>:words`, list) |

---

### 2.7. Не входит в v2 (явно отсечено)

- Регистрация / логин / OAuth.
- Чат текстовый.
- **Реакции / эмодзи** в онлайн-игре (карточки 🔥🤔😂👏 — отсечены).
- Загрузка пользовательских пакетов слов (карточка «Свой пакет» в дизайне
  показана как `locked`/teaser).
- Голосовая связь.
- Поддержка нескольких игр в одной библиотеке («только Alias»).
- Анти-чит / валидация что explainer не показал слово в окне.
- Мобильные приложения (только PWA-friendly web).
- Подмена explainer'а внутри раунда другим игроком.
- `Room.allowJoinAfterStart` (вход в комнату после старта игры).

### 2.8. Порядок реализации (рекомендованный)

1. Монорепо-скелет (`apps/web`, `apps/ws`, `packages/shared`, `prisma/`).
2. Перенос seed + новой схемы, прогон миграции.
3. Дизайн-токены + базовые UI компоненты (Button, Card, Pill, Toggle, ...).
4. Локальный режим end-to-end (Home → setup → game → results), без онлайна.
   — на нём проверить, что вся UI-обвязка и подсчёт очков работают.
5. REST для комнат (`POST /api/rooms`, `POST /api/rooms/[code]/join`).
6. Socket.io сервер: подключение, `room:hello` → `RoomSnapshot`,
   join/leave, lobby-события.
7. Игровой цикл: PRE_ROUND → ROUND_ACTIVE → ROUND_REVIEW → BETWEEN_ROUNDS →
   FINISHED.
8. Reconnect, persistence снапшота между раундами.
9. Реакции (опц.), public rooms (опц.).
10. PWA-меta, тёмная/светлая тема, RU/EN i18n (опц.).

---

> Дальше — в `CURRENT_CODE.md` (что было) и `DESIGN.md` (как выглядит).
