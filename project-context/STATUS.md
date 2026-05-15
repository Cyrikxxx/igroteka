# STATUS — Alias Online v2

> Лог сессий разработки. Каждая запись: дата, что сделано, где остановились, следующий шаг.
> Самые свежие записи — сверху.

---

## 2026-05-15 · Сессия 9: полировка онлайна перед деплоем

### Что сделано

#### Багфикс: реконнект после выхода из браузера

`apps/web/src/app/api/rooms/[code]/join/route.ts` — раньше эндпоинт
возвращал 409 «Game already started» всем подряд при `Room.status =
IN_GAME`. Теперь 409 получают только **новые** игроки, существующие
Participant'ы (и сам хост) могут переподключаться в любой момент.
Это устраняет «вылет» игрока при закрытии вкладки на телефоне.

#### Багфикс: двойная вкладка ломала счётчик online

`apps/ws/src/handlers/lobby.ts` — в `disconnect` теперь проверяется,
есть ли у этого userId другие активные сокеты в комнате через
`ns.in(...).fetchSockets()`. Если есть — не помечаем offline. Это
устраняет «прыгающий» счётчик при HMR-перезагрузке вкладки или второй
открытой вкладке.

#### Дебаунс broadcast'ов (PROMPT.md §2.4.4)

`apps/ws/src/broadcast.ts` — `scheduleStateBroadcast(ns, code)`
откладывает `room:state` на 50мс, склеивая серию быстрых мутаций в
один бродкаст. Используется в `lobby.ts` (round.ts оставлен на
немедленных бродкастах — критичны для геймплея).

#### Багфикс: LAN-доступ с телефонов

- `apps/web/next.config.ts` — добавлен `allowedDevOrigins` с
  диапазонами `192.168.*.*`, `10.*.*.*`, `172.16-31.*.*`, `26.*.*.*`
  (Hamachi). Иначе Next.js 16 блокировал загрузку `_next/*` ресурсов
  с LAN-IP, и JS на телефоне не запускался.
- `apps/web/src/lib/ws-token.ts` — `wsConnectUrlFor(request)` теперь
  берёт hostname из `request.headers.host`. Если страница открыта по
  LAN-IP — клиенту возвращается `http://<lan-ip>:3001`, а не
  `localhost`.
- `apps/ws/src/index.ts` — WS-сервер слушает на `0.0.0.0:3001`
  (раньше неявно `localhost`), CORS в dev открыт на любой origin.

#### Modal-компонент

`apps/web/src/components/ui/Modal.tsx` — переиспользуемый диалог:
backdrop с blur, Esc-close, опциональный fullscreen-режим. Базовая
основа для всего, что было через `confirm()/alert()`.

#### Pause-modal + confirm-end в онлайн-игре

`apps/web/src/app/room/[code]/play/page.tsx`:
- Кнопка «Пауза» открывает модалку с кнопками «Продолжить»
  и «Завершить раунд» (DESIGN.md §5.9 PauseScreen). В подвале —
  статистика «+N угадано / 00:NN осталось».
- Кнопка «Завершить раунд» (и в баре, и в pause-modal) открывает
  отдельный confirm-диалог вместо `confirm()` JS.
- Доступно только хосту и текущему объясняющему.

#### Reconnect overlay

Полноэкранный `Modal` с pulse-индикатором, заголовком
«Переподключаемся…» и кнопкой «На главную». Показывается при
`status === "reconnecting"` или `status === "error"` — и в лобби, и
в игре. Заменяет крошечную плашку OFFLINE в углу.

#### Explainer-drop баннер

На `/room/[code]/play` для хоста: если во время `ROUND_ACTIVE`
текущий объясняющий помечен offline в snapshot'е, поверх контента
появляется баннер «X отключился» с кнопкой «Завершить раунд».
Хост не должен сидеть и ждать пустого таймера до нуля. Реализация
не использует `EXPLAINER_DROP_TIMEOUT_MS` — баннер показывается
сразу, чтобы хост сам решил, ждать ли реконнекта или завершить.

### Проверка

`npm run typecheck` чистый. Все страницы (`/`, `/join`, `/room/new`,
`/room/[code]`, `/room/[code]/play`, `/results/[gameId]`)
возвращают 200, WS `/health` → PONG.

### Где остановились

Полировка онлайна закончена. Все известные UX-косяки закрыты:
- Реконнект работает в любой фазе.
- Pause-модалка корректная.
- Reconnect overlay при потере связи.
- Хост видит баннер с кнопкой если объясняющий пропал.
- LAN-доступ с телефонов через дев-сервер работает.

**Готовы к деплою.**

### Следующий шаг — Сессия 10: деплой

Что нужно от пользователя:
1. **GitHub-репозиторий** — создать (приватный/публичный — на выбор),
   подключить локальный репо как remote.
2. **Vercel-аккаунт** — Sign Up через GitHub, импорт репо.
3. **Railway-аккаунт** уже есть. Подключить тот же репо как сервис
   с корнем `apps/ws/`.

Что сделаю я:
1. `git push` инструкции + первый коммит структуры.
2. Поправить `package.json` build-команды:
   - Vercel: добавить `prisma migrate deploy &&` в build.
   - Railway: указать `build`/`start` для WS-сервера.
3. `vercel.json` если потребуется (root directory: `apps/web`).
4. Перечень env-переменных, которые нужно прописать в обоих сервисах.
5. После первого деплоя — обновить `NEXT_PUBLIC_WS_URL` на
   реальный Railway-домен и пересобрать Vercel-приложение.

### Долг / TODO (вне scope деплоя)

- QR-код в лобби (`react-qr-code` или `qrcode`).
- Toast-уведомления о входе/выходе игроков.
- Светлая тема + переключатель в Header.
- Локализация RU/EN.
- Удалить `apps/ws/src/smoke*.ts` (тестовые скрипты) — либо перенести
  в `apps/ws/scripts/`.

---

## 2026-05-14 · Сессия 8: онлайн 2.4 — игровой цикл

### Что сделано

**Онлайн-игра полностью работает end-to-end.** Можно из лобби нажать
«Начать игру», пройти PRE_ROUND → ROUND_ACTIVE → ROUND_REVIEW →
BETWEEN_ROUNDS, и так пока кто-то не наберёт `winScore`. Слова уходят
объясняющему приватно, остальные видят только счётчик «угадал/пропуск».

#### WS-сервер: сервисы и стейт-машина

`apps/ws/src/prisma.ts` — singleton клиента из
`@alias/shared/generated/prisma` (тот же, что и web). Добавлен
`@prisma/client` в `apps/ws/package.json`.

`apps/ws/src/services/`:
- **`score.ts`** — `scoreRound({guessed, skipped, penaltySkip,
  currentTeamScore}) → {scoreEarned, newTeamScore}` + `checkWinner`.
  Чистая логика, идентичная локальному режиму.
- **`turn.ts`** — `nextTurn({...})` и `nextPlayerIndex`.
- **`word.ts`** — `fetchWordsBatch(gameId, n)` (NOT EXISTS-запрос),
  `pushWordsToQueue` (RPUSH), `popNextWord` (LPOP), `clearWordsQueue`,
  `remainingWordsCount`. Очередь хранится в Redis под ключом
  `room:<code>:words`.
- **`roundState.ts`** — состояние текущего раунда в Redis под
  `room:<code>:round` (JSON: `{teamId, explainerUserId, playerName,
  roundNumber, durationMs, startedAt, pausedAt, pausedTotalMs,
  wordsSeen[], currentWord*}`). Включает `msLeft(state)` с учётом пауз.
- **`timer.ts`** — per-room `setInterval` (250ms тик), эмитит
  `round:tick` всем в комнате.
- **`game.ts`**:
  - `createGameFromSnapshot(snapshot, roomId)` — на `LOBBY → PRE_ROUND`
    создаёт `Game` + `Team[]` + `Player[]` в Postgres, возвращает
    `gameId` и `teamIdMap` (локальный snapshot teamId → Postgres
    Team.id). Меняет `Room.status = IN_GAME`.
  - `finalizeRound({...})` — на `ROUND_REVIEW → BETWEEN_ROUNDS` в
    одной транзакции: создаёт `Round` + `RoundWord[]`, обновляет
    `Team.score` и `Team.currentPlayerIndex`, апдейтит `Game`
    (currentTeamIndex/RoundNumber/usedWordIds/status). Возвращает
    результат + флаг `gameFinished`.
  - `finalizeRoom(roomId)` — `Room.status = FINISHED`, `endedAt`.

#### WS-сервер: handler/round.ts

Стейт-машина (PROMPT.md §2.6.1) полностью реализована:

| Событие | Что делает |
| --- | --- |
| `round:start_game` (host) | Валидация ≥2 команд, ≥2 онлайн-игрока на команду. Offline → в зрители. `createGameFromSnapshot` → snapshot.phase=PRE_ROUND. `scheduleCountdown(3)`. |
| `enterRoundActive` (внутр.) | `fetchWordsBatch(50)` → `pushWordsToQueue`. Достаём первое слово, приватно эмитим `round:word` explainer'у. Стартуем `startTimer` → каждые 250ms эмитим `round:tick`. |
| `round:guess` (explainer) | Фиксируем guessed на текущем слове, попаем следующее, приватный `round:word` + бродкаст `round:word_count`. Если слова кончились — досрочный `finishRound`. |
| `round:pause/resume` (host или explainer) | Обновляет `pausedAt/pausedTotalMs` в roundState, отражает в `snapshot.timer.paused`. |
| `round:end` (host или explainer) | Досрочный `finishRound`. |
| `finishRound` (timer/exhausted/end) | Останавливаем таймер, snapshot.phase=ROUND_REVIEW, эмитим `round:review` со списком слов. |
| `round:review_toggle` (explainer) | Меняет `guessed` на слове в roundState, ре-эмитит `round:review`. |
| `round:review_confirm` (explainer) | `finalizeRound` (транзакция). Если game finished — `Room.status=FINISHED`. Иначе snapshot.phase=BETWEEN_ROUNDS, currentTeam → next, инкремент playerCursor. Через 4 сек → `scheduleCountdown(3)` следующего раунда. Эмитим `round:committed` всем. |

Реализован реэмит текущего слова при реконнекте explainer'а
(`maybeRehydrateExplainer`, вызывается из room:hello).

#### Shared: типы раунда

`packages/shared/src/domain.ts` пополнен:
- `RoundPhasePayload`, `RoundCountdownPayload`, `RoundTickPayload`,
  `RoundWordPayload`, `RoundWordCountPayload`, `RoundReviewWord`,
  `RoundReviewPayload`, `RoundCommittedPayload`.
- `RoomSnapshotTeam.playerCursor?: number` — индекс следующего
  объясняющего внутри команды.
- `RoomSnapshot.teamIdMap?: Record<number, number>` — snapshot teamId
  → Postgres Team.id. Хранится в snapshot для сервера, в UI не
  используется.
- `RoomSnapshot.currentTeamIndex?: number`.

#### Web: useRoom расширен

Хук `apps/web/src/hooks/useRoom.ts` теперь возвращает:
`{ socket, snapshot, status, error, countdown, tick, currentWord,
wordCount, review, lastCommitted }`. Подписки на все 7 round-событий,
автоматическая инвалидация полей при смене фазы.

#### Web: страницы

- **`/room/[code]/play`** (`apps/web/src/app/room/[code]/play/page.tsx`) —
  игровой экран. Определяет роль (`explainer | guesser | spectator`) из
  `currentPlayerId / myTeam`. Подвиды:
  - `PreRoundView` — большая countdown цифра 3-2-1 с подписью «Команда X
    · объясняет Y».
  - `ActiveRoundView`:
    - explainer: BigTimer, WordCard со словом, ActionBar (Skip/Got),
      Pause/Resume/End.
    - guesser/spectator: BigTimer, SpectatorCard «X объясняет», без
      кнопок. Eyebrow «ВЫ УГАДЫВАЕТЕ» vs «ВЫ СМОТРИТЕ».
  - `ReviewView` — список слов с +1/−1, всем видно; explainer может
    кликом перевернуть статус, остальные read-only. Кнопка
    «Подтвердить и передать ход» только у explainer'а.
  - `BetweenRoundsView` — «Команда Y, объясняет Z» (4 сек).
- **`/room/[code]`** (лобби) теперь:
  - Авто-редиректит на `/play` при `phase != LOBBY` и на `/results/[gameId]`
    при `phase = FINISHED`.
  - Кнопка «Начать игру» активирована, шлёт `round:start_game`.
- **`/results/[gameId]`** (`apps/web/src/app/results/[gameId]/page.tsx`) —
  общий экран финального счёта для LOCAL и ONLINE. Кнопка «Новая
  игра» / «Новая комната» зависит от `Game.mode`.

#### Web: API расширен

`GET /api/games/[id]` теперь разрешает чтение игры участникам
онлайн-комнаты (`Participant` по `roomId_userId`), а не только владельцу.
Без этого онлайн-игроки не могли увидеть свои результаты.

#### Инфра: `npm run dev`

Скрипты в корневом `package.json` упрощены:
```
"dev": "concurrently --raw -n web,ws -c green,cyan 'npm:dev:web' 'npm:dev:ws'"
"dev:web": "cd apps/web && next dev"
"dev:ws":  "cd apps/ws && tsx watch src/index.ts"
```
Под Windows прокидывание через `npm run dev --workspace` глотало
stdout `tsx watch`, и WS-сервер «висел» без вывода. Прямой запуск
работает стабильно.

### Проверка

`npm run typecheck` обоих пакетов чистый.

End-to-end smoke (`npx tsx apps/ws/src/smoke-game.ts` при поднятом
`npm run dev`):
```
[create]    code=KSW87X
[host]      teams=0 → создаёт Red,Blue
[players]   3 игрока, A→Red, B→Blue, C→Blue
[start]     ok
[phase]     PRE_ROUND → ROUND_ACTIVE (countdown 3 сек)
[explainer] получил приватно слово "коала"
[guess]     1 угадал, 1 пропустил
[timer]     истёк → ROUND_REVIEW
[confirm]   ok
[commit]    BETWEEN_ROUNDS, scores: Red=1, Blue=0
```

### Где остановились

Онлайн-цикл работает. Можно открыть три вкладки (host + 2 игрока),
сыграть полный раунд, увидеть передачу хода между командами, и так до
победы — игра сама редиректит всех на `/results/[gameId]`.

### Следующий шаг — кусок 2.5: устойчивость

1. **Reconnect overlay** при `status: reconnecting` (сейчас просто pill
   в углу).
2. **EXPLAINER_DROP_TIMEOUT_MS** (30 сек) — если объясняющий dropped
   во время ROUND_ACTIVE, хост получает алерт-toast с кнопкой
   «Завершить раунд досрочно». В коде есть константа, но логика
   таймера ещё не реализована.
3. **Защита от race** на Redis-мутации — сейчас `mutate(code, fn)` =
   read-modify-write без блокировки. Для лобби риск минимален, для
   игрового цикла на серверном таймере могут быть концепы. Добавить
   простой `SET NX EX` lock в горячих местах.
4. **Polling/fallback** — Socket.io по умолчанию пытается websocket,
   но при проблемах с CORS / прокси можно переключиться на polling.
   Сейчас явно указан `transports: ['websocket']` — добавить fallback.

После 2.5 — Этап 3 (полировка): QR-код для приглашения,
toast-уведомления, тёмная/светлая тема, мобильная PWA-мета.

### Долг / TODO

- `apps/ws/src/smoke*.ts` (smoke, smoke-flow, smoke-lobby, smoke-game) —
  4 тестовых скрипта в `src/`. Имеет смысл перенести в
  `apps/ws/tests/` или удалить когда стабилизируем.
- `round:word.total` сейчас приблизительный (= текущий order+1), а не
  реальный размер пакета. Не критично — UI его не показывает, но
  поправить при доводке.
- Снижение `roundTime` < 10 секунд блокируется валидацией POST
  `/api/rooms`. Если потребуется — отдельный whitelist в shared
  `ROUND_TIME_OPTIONS`.

---

## 2026-05-14 · Сессия 7: онлайн 2.3 — лобби (UI + WS-события)

### Что сделано

#### `@alias/shared` — общие билдеры snapshot'а

`packages/shared/src/redis-keys.ts`:
- `roomKey(code)`, `roomLockKey`, `roomWordsKey`, `roomTimerKey`,
  `codeReverseKey`, `userRoomsKey` — ключи Redis, общие для web и ws.

`packages/shared/src/snapshot-builders.ts` — чистые функции (без I/O):
- `buildLobbySnapshot` (вынесен из web).
- `findPlayer(snap, userId)` — где сейчас игрок (team / spectator / null).
- `removePlayer(snap, userId)` — извлечь игрока отовсюду.
- `setOnline(snap, userId, online)` — обновить флаг.
- `nextTeamId(snap)` — локальный auto-increment id команды в лобби.

`apps/web/src/lib/room-snapshot.ts` теперь делегирует построение в
shared, оставляя у себя только обёртки `save/load/delete` поверх
ioredis. Зеркальный `apps/ws/src/snapshot.ts` — то же самое, но через
свой WS-side ioredis-клиент (+ `mutate(code, fn)` для read-modify-write).

#### WS-сервер — события лобби

`apps/ws/src/types.ts` — заполненные generics для Socket.io: типы
событий `ClientToServer` (`room:hello`, `team:create/rename/remove/join`,
`room:rename`, `room:leave`) и `ServerToClient` (`room:state`,
`room:player_*`, `room:closed`, `error`).

`apps/ws/src/io-types.ts` — `AppSocket` / `AppNamespace` (вынесено
из types.ts для разрыва циклов между handlers и auth).

`apps/ws/src/handlers/lobby.ts` (~200 строк):
- `room:hello` — помечает online, broadcast `room:state`, ack снимком.
- `team:create` (host) — auto-id, цвет по индексу (`teamColorVar`),
  max-проверка по `MAX_TEAMS`.
- `team:rename` / `team:remove` (host) — валидация, broadcast.
- `team:join (teamId | null)` (любой) — корректное перемещение из
  team↔team↔spectators, fallback в зрители если команда переполнена.
- `room:rename` (host), `room:leave` (любой).
- `disconnect` — `setOnline(false)` + broadcast.

`apps/ws/src/auth.ts` обновлён под `AppSocket` из io-types.
`apps/ws/src/index.ts` подключает `registerLobbyHandlers(roomNs, socket)`
на каждом connection.

#### Web — клиент Socket.io и хук комнаты

`apps/web/src/lib/socket-client.ts` — singleton-клиент с
авто-reconnect (8 попыток, 500ms→5s backoff). `connectToRoom(opts)`
переоткрывает если поменялись (wsUrl|code|token).

`apps/web/src/hooks/useRoom.ts` — стейт-машина:
- `status: "connecting" | "connected" | "reconnecting" | "error" | "closed"`
- `snapshot: RoomSnapshot | null` — обновляется по `room:state`.
- При `connect` сразу шлёт `room:hello` (сервер помечает online).
- На unmount страницы — полный `disconnectRoom()`.

`apps/web/src/lib/room-session.ts`:
- `saveRoomCreds / loadRoomCreds / clearRoomCreds` —
  `RoomCredentials` (code, wsUrl, wsToken, userId, displayName)
  живут в sessionStorage по ключу `alias.room.<code>`.
- `saveDisplayName / loadDisplayName` — глобальный ник в localStorage.

#### Web — страницы

- **`/join`** (mobile-friendly): input для 6-значного кода (auto-upper,
  моно-шрифт), input ника (prefill из localStorage), кнопка «Войти».
  Обрабатывает 404 / 410 / 409 человекочитаемо.
- **`/room/new`**: одна страница с полями host name, title, time chips,
  score chips, penalty toggle, categories grid. POST `/api/rooms` →
  `saveRoomCreds` → redirect на `/room/[code]`.
- **`/room/[code]`** — настоящее лобби:
  - Header с pill'ами LIVE / код / индикатор соединения
    (ONLINE / RECONNECT… / OFFLINE).
  - Левая колонка — grid team-card'ов (gradient по `--team-N`),
    каждая с inline-rename (host), удалением (host), кнопкой
    «Занять место» для остальных. Блок зрителей внизу с
    online-точкой у каждого. Кнопка «выйти в зрители» для тех, кто
    в команде.
  - Правая колонка — карточка с кодом (большой моно), кнопки
    «Копировать код» / «Копировать ссылку» (через
    `navigator.clipboard`); карточка с настройками; кнопка
    «Начать игру (скоро)» (disabled до 2.4) + подпись «Готово к
    старту» / «Нужно ≥2 команды…»; «Закрыть комнату» для хоста,
    «Выйти из комнаты» для всех.
- **Главная**: убран бэйдж «Скоро» с ModeCard, CTA для онлайн-режима
  активированы (Создать комнату → `/room/new`, Войти по коду → `/join`).

### Проверка

`npm run typecheck` обоих пакетов чистый.

Smoke `npx tsx apps/ws/src/smoke-lobby.ts` (при поднятом dev):
```
[create]   code=Y3FHZT hostId=...
[join]     playerId=...
[ws/host]  hello: 0 teams, 2 specs
[ws/player] hello: 0 teams, 2 specs
[host]     team:create → { ok: true, teamId: 1 } { ok: true, teamId: 2 }
[player]   team:join → { ok: true }
[final]    teams: [{Лисы, []}, {Совы, [PlayerAlice]}], spectators: [HostBob]
[disconnect] Alice.online = false
[ok] smoke-lobby passed
```

Все страницы отвечают 200 (`/`, `/join`, `/room/new`, `/room/CODE`).

### Где остановились

Полное лобби работает. Можно:
1. Открыть `/room/new`, создать комнату.
2. С другого устройства / в режиме инкогнито открыть `/join`,
   ввести код и ник, попасть в ту же комнату.
3. Видеть друг друга в реальном времени, создавать команды, переходить
   между ними и в зрители.

Кнопка «Начать игру» пока заблокирована.

### Следующий шаг — кусок 2.4: игровой цикл онлайн

1. **State machine на WS-сервере** (PROMPT.md §2.6.1):
   - LOBBY → PRE_ROUND (host:start_game): создать `Game/Team/Player`
     в Postgres, выдать `gameId` снапшоту, countdown 3-2-1.
   - PRE_ROUND → ROUND_ACTIVE: вытащить пакет слов в Redis-очередь
     `room:<code>:words`, начать `setInterval` для `round:tick`.
   - ROUND_ACTIVE → ROUND_REVIEW: остановить таймер, отправить
     `round:review` всей команде объясняющего.
   - ROUND_REVIEW → BETWEEN_ROUNDS: транзакция `Round + RoundWord +
     Team.score + Game.*` в Postgres.
   - Победа → FINISHED.

2. **Приватный emit слов** — `round:word` шлётся только explainer'у
   (`socket.to(socketId).emit`); остальные видят `round:word_count`.

3. **Серверный таймер** — `apps/ws/src/services/timerService.ts` с
   per-room setInterval(1000ms), эмитит `round:tick`.

4. **UI**:
   - `/room/[code]/play` — игровой экран онлайн (explainer / guesser /
     spectator views).
   - `/room/[code]/results/[gameId]` или сразу
     `/results/[gameId]` — общая страница итогов.

### Долг / TODO

- `apps/ws/src/smoke*.ts` — три скрипта, мигрировать в
  `apps/ws/scripts/` или `apps/ws/tests/` при следующем рефакторинге.
- `comingSoon` остался prop'ом у `ModeCard` (не используется) —
  убрать при следующей правке home.
- QR-кода в лобби пока нет — добавить в полировке (`qrcode` lib +
  компонент). Кнопка «Копировать ссылку» компенсирует.
- Reconnect overlay при `status: reconnecting` сейчас выглядит как
  pill в хедере. Полноэкранный overlay (как в DESIGN.md §8.3) —
  при доводке.

---

## 2026-05-13 · Сессия 6: онлайн 2.2 — REST для комнат

### Что сделано

#### `@alias/shared` — типы онлайн-режима

В `packages/shared/src/domain.ts` добавлено:
- `RoomStatus = "LOBBY" | "IN_GAME" | "FINISHED"`
- `ParticipantRole = "PLAYER" | "SPECTATOR"`
- `Phase = "LOBBY" | "PRE_ROUND" | "ROUND_ACTIVE" | "ROUND_REVIEW"
  | "BETWEEN_ROUNDS" | "FINISHED"`
- `RoomSnapshot` (см. PROMPT.md §2.6.5): code, title, status, hostId,
  settings, phase, currentTeamId/PlayerId/RoundNumber, teams[],
  spectators[], timer, scoreboard, gameId.
- `CreateRoomResponse`, `JoinRoomResponse` — формат ответа REST.

#### Web — инфраструктура для Redis

`apps/web/src/lib/redis.ts` — singleton ioredis-клиент. В deps web
добавлен `ioredis`.

`apps/web/src/lib/room-snapshot.ts`:
- `saveRoomSnapshot` / `loadRoomSnapshot` / `deleteRoomSnapshot` —
  работают с ключом `room:<code>`, TTL 24ч (`ROOM_TTL_SECONDS` в shared).
- `buildLobbySnapshot` — формирует стартовый JSON для LOBBY (хост
  попадает в `spectators` с `online: false` — WS-сервер пометит онлайн
  при подключении).

`apps/web/src/lib/room-code.ts`:
- Алфавит 32 символа `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (без 0/O/1/I/L),
  6 символов.
- `generateUniqueRoomCode` — цикл с проверкой `Room.code` в Postgres,
  макс 5 попыток.
- `isValidRoomCode` — формат-валидация для входящих параметров.

#### REST-эндпоинты (PROMPT.md §2.3.3)

**`POST /api/rooms`** (`src/app/api/rooms/route.ts`)
- Валидация: `hostName` ≥ 1 символ, `settings.roundTime` 10..300,
  `winScore` 0..1000, ≥1 категория.
- `ensureUser` — upsert Postgres User с displayName хоста.
- `generateUniqueRoomCode` → транзакция `Room.create` + `RoomCategory[]`
  + `Participant` (host = SPECTATOR, joinOrder=0).
- `saveRoomSnapshot(buildLobbySnapshot(...))` — кладёт стартовый
  snapshot в Redis.
- Возвращает `{ room, user, wsUrl, wsToken }` через `issueWsToken({ ...,
  role: "host" })`.

**`POST /api/rooms/[code]/join`** (`src/app/api/rooms/[code]/join/route.ts`)
- 400 если код невалиден.
- 404 если комнаты нет, 410 если FINISHED, 409 если IN_GAME (поздний
  вход в v2 запрещён, см. §2.7).
- `ensureUser` с displayName.
- Идемпотентный `Participant` через `findUnique({roomId_userId})`:
  если есть и `leftAt` стоит — сбрасываем; если новой записи нет —
  создаём с очередным `joinOrder`.
- Обновляет snapshot: добавляет нового зрителя, если его ещё нет ни в
  команде, ни в списке зрителей.
- Возвращает `wsToken` с `role: "player"` (или `"host"`, если это
  переподключение хоста).

**`GET /api/rooms/[code]`** (`src/app/api/rooms/[code]/route.ts`)
- Сначала Redis (`loadRoomSnapshot`).
- Если snapshot ушёл по TTL — восстанавливает минимум из Postgres
  (host + settings + статус), кладёт обратно в Redis. FINISHED-комнаты
  не кэшируем — они read-only.

**`DELETE /api/rooms/[code]`**
- 403 если `Room.hostId !== userId`.
- Помечает `Room.status = FINISHED`, ставит `endedAt`.
- Удаляет snapshot из Redis (`deleteRoomSnapshot`).

### Проверка

`npm run typecheck` чистый.

Smoke-тест через curl (`npm run dev` поднят):
- POST `/api/rooms` → код `YDCE2E`, ответ содержит wsToken (182 chars).
- POST `/api/rooms/YDCE2E/join` с другим cookie → `playersCount: 2`,
  player-токен (184 chars).
- GET `/api/rooms/YDCE2E` → snapshot с `spectators: ["Vanya","Masha"]`,
  phase=LOBBY.
- DELETE от не-хоста → 403.
- DELETE от хоста → 204; повторный GET возвращает status=FINISHED.

End-to-end (`npx tsx apps/ws/src/smoke-flow.ts`):
- REST создаёт комнату.
- Socket.io-client подключается к `/room` с выданным wsToken.
- `room:hello` возвращает `{ ok, userId, roomCode, role: "host" }`.

### Где остановились

Полная цепочка REST + WS работает «под капотом»: REST выдаёт токен →
WS его принимает. UI лобби ещё нет.

### Следующий шаг — кусок 2.3: UI лобби + WS-события лобби

1. **Web-side WS-обвязка**:
   - `apps/web/src/lib/socket-client.ts` — singleton Socket.io-client
     с авто-reconnect.
   - `apps/web/src/hooks/useRoom.ts` — стейт-машина: подписка на
     `room:state`, обработка disconnects.
2. **UI**:
   - `/room/[code]/page.tsx` — лобби. Two-column на desktop:
     слева список команд + зрителей, справа панель хоста с кодом
     комнаты, QR-кодом и кнопкой «Начать игру».
   - `/join/page.tsx` — ввод кода + ника, POST `/api/rooms/[code]/join`,
     redirect на `/room/[code]`.
   - Главная: убрать бэйдж «Скоро» с онлайн-режима, активировать
     кнопку «Создать комнату» (форма на `/room/new`).
3. **WS-события лобби** на сервере (`apps/ws/src/handlers/lobby.ts`):
   - `team:create` / `team:rename` / `team:remove` (только host)
   - `team:join` — игрок переходит в команду или в зрители
   - `room:state` бродкаст после каждого изменения.

### Долг / TODO

- `apps/ws/src/smoke.ts` и `smoke-flow.ts` пока хранятся прямо в src/.
  Перенести в `apps/ws/scripts/` или удалить после стабилизации.
- На join'е игрока в snapshot.spectators online=false. Реальный
  online-флаг обновится только когда игрок коннектится к WS — это
  логика WS-сервера (2.3+).
- Хост в snapshot после создания комнаты тоже online=false до
  подключения к WS. Это нормально, но в UI лобби на стороне хоста
  он должен сразу видеть себя как online — UI решит это через
  собственный userId.

---

## 2026-05-13 · Сессия 5: онлайн 2.1 — скелет WS-сервера

### Что сделано

#### Новые секреты в `.env`

- `REDIS_URL` — Upstash (rediss://, TLS).
- `WS_TOKEN_SECRET` — 96 hex-символов через `crypto.randomBytes(48)`.
- `NEXT_PUBLIC_WS_URL=http://localhost:3001` — адрес WS для клиента в dev.

#### `@alias/shared` — токены

`packages/shared/src/token.ts`:
- `signWsToken({ userId, roomCode, role }, secret, ttlMs)` —
  собирает `<base64url(payload)>.<base64url(hmacSha256)>`.
- `verifyWsToken(token, secret)` — проверяет подпись через
  `timingSafeEqual`, валидирует поля и `exp`.
- `WS_TOKEN_TTL_MS = 1h` по умолчанию.
- Тип `WsRole = "host" | "player"`.

Без JWT-библиотек, только `node:crypto`. Подходит и для Next.js
route handlers (Node runtime), и для Socket.io middleware.

#### `apps/ws/` — WS-сервер

Файлы:
- `package.json` — `@alias/ws`, deps: `socket.io`, `ioredis`, тип
  module=ESM, скрипты `dev`/`start` через `tsx`, `typecheck`.
- `tsconfig.json` — ES2022 + ESNext modules, bundler resolution.
- `src/env.ts` — side-effect loader корневого `.env`
  (как в `next.config.ts`).
- `src/redis.ts` — ioredis-клиент к Upstash, события `connect`/`ready`/`error`.
- `src/types.ts` — generics для Socket.io (`SocketData = { userId, roomCode, role }`,
  заглушки `ClientToServerEvents`/`ServerToClientEvents` под расширение).
- `src/auth.ts` — middleware, читает `handshake.auth.{token, code}`,
  пропускает только если `verifyWsToken` ок и `code` совпадает с
  `payload.roomCode`. На неуспех — `next(new Error(...))` → клиент
  получает `connect_error`.
- `src/index.ts` — HTTP-сервер с `/health` (отдаёт `{ ok, redis: PONG }`)
  и Socket.io на namespace `/room`. `room:hello` → ack с
  `{ ok, userId, roomCode, role }` (sanity-check). Graceful shutdown
  на SIGINT/SIGTERM.
- `src/smoke.ts` — оффлайн скрипт-проверка 4 сценариев auth (no token /
  bad token / wrong code / valid). Запуск: `npx tsx apps/ws/src/smoke.ts`
  пока `npm run dev` поднят.

#### Web-side помощник

`apps/web/src/lib/ws-token.ts`:
- `issueWsToken({ userId, roomCode, role })` — обёртка над
  `signWsToken` для REST-эндпоинтов `/api/rooms/...` (будут в 2.2).
- `wsConnectUrl()` — берёт `NEXT_PUBLIC_WS_URL`, дефолт
  `http://localhost:3001`.

#### Concurrent dev

Корневой `package.json`:
- `npm run dev` → `concurrently` запускает web и ws в одном окне,
  префиксы `[web]` / `[ws]` цветные.
- `npm run typecheck` — `tsc --noEmit` в обоих пакетах через
  `--workspaces --if-present`.
- В deps добавлены `concurrently`.

`apps/web/package.json` — добавлен `socket.io-client` (понадобится в
2.3 для подключения из UI; пока используется в smoke-скрипте).

### Проверка

`npm run typecheck` обоих пакетов чистый.

`npm run dev` поднимает web (`:3000`) и ws (`:3001`):
```
[ws] loaded env from .../.env
[ws] listening on http://localhost:3001
[ws] CORS origin: http://localhost:3000
[ws] [redis] connected
[ws] [redis] ready
[web] ✓ Ready in 395ms
```

`curl http://localhost:3001/health` → `{"ok":true,"redis":"PONG", ...}`.

Smoke-test (`npx tsx apps/ws/src/smoke.ts`):
```
[1] no token  → { ok: false, error: 'missing token or room code' }
[2] bad token → { ok: false, error: 'invalid token' }
[3] mismatch  → { ok: false, error: 'token/room code mismatch' }
[4] valid     → { ok: true, ack: { ok: true, userId, roomCode, role } }
```

### Где остановились

Инфраструктура поднята: web ↔ ws ↔ Redis говорят. Authentication
работает. Дальше — *API комнат* (2.2).

### Следующий шаг — кусок 2.2: REST для комнат

1. `POST /api/rooms` — создать комнату:
   - body: `{ hostName, title?, isPublic?, settings }`.
   - создаёт `User` (если cookie `aid` нет) или обновляет displayName,
   - генерирует 6-символьный `code` через `codeService.generateUniqueCode`
     (алфавит `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, см. PROMPT.md §2.6.3),
   - создаёт `Room` со статусом `LOBBY` в Postgres,
   - кладёт стартовый JSON-snapshot в Redis (`room:<code>`),
   - возвращает `{ room, user, wsUrl, wsToken }` (через `issueWsToken`).

2. `POST /api/rooms/[code]/join` — войти:
   - body: `{ displayName }`,
   - 404 если нет, 410 если FINISHED, 409 если IN_GAME,
   - создаёт `Participant`, выдаёт `wsToken` с `role=player`.

3. `GET /api/rooms/[code]` — снимок (RoomSnapshot из Redis).

После 2.2 — кусок 2.3 (лобби-страница `/room/[code]` + WS-события
лобби).

### Долг

- `apps/ws/src/smoke.ts` — пока хранится в src/ рядом с сервером;
  `tsx watch` не подхватывает её как часть entry, но визуально
  захламляет. На 2.3+ перенести в `apps/ws/tests/` или удалить
  после стабилизации.



### Что сделано

#### Монорепо

1. **Структура (см. PROMPT.md §2.1.3):**
   ```
   alias-online/
   ├── apps/
   │   ├── web/                  ← Next.js (всё, что было в src/, переехало сюда)
   │   └── ws/                   ← Socket.io сервер (заглушка, заполним при онлайне)
   ├── packages/
   │   └── shared/               ← общие типы + константы + Prisma client
   ├── prisma/                   ← один schema/migrations/seed на оба сервиса
   ├── .env                      ← один .env на всё монорепо
   └── package.json              ← workspace coordinator
   ```

2. **npm workspaces** (`"workspaces": ["apps/*", "packages/*"]` в корневом
   `package.json`). Один `node_modules` на всех с hoisting'ом. Один
   `package-lock.json`. Скрипты на верхнем уровне делегируют в `@alias/web`:
   `npm run dev` → `next dev`, `npm run build`, `npm run lint`. Prisma
   CLI (`db:migrate`, `db:seed`, `db:generate`) живёт в корне.

3. **`packages/shared/`** — новый пакет `@alias/shared`:
   - `src/constants.ts` — MIN_TEAMS, MAX_TEAMS, ROUND_TIME_OPTIONS, …,
     plus новые константы для онлайна (`MAX_ROOM_PLAYERS`,
     `ROOM_TTL_SECONDS`, `EXPLAINER_DROP_TIMEOUT_MS`).
   - `src/domain.ts` — все DTO API (`GameFromAPI`, `TeamFromAPI`,
     `WordInRound`, и т.д.).
   - `src/generated/prisma/` — клиент Prisma теперь генерируется сюда
     (новый `output` в `prisma/schema.prisma`), импортируется обеими
     сторонами через `@alias/shared/generated/prisma`.
   - `package.json` экспортирует `.`, `./constants`, `./domain` и
     `./generated/prisma`. `"type": "module"`, `main`/`types` указывают
     на TS-исходники (без сборки — Next 16 / tsx читают TS напрямую).

4. **`apps/web/`** — содержимое прежнего корня:
   - Старые `src/constants/game.ts` и `src/types/index.ts` стали
     тонкими re-export'ами из `@alias/shared` — все импорты в коде
     остаются прежними (`@/types`, `@/constants/game`).
   - `tsconfig.json` получил пути `@alias/shared` и `@alias/shared/*`,
     `include` дополнен `../../packages/shared/src/**/*.ts`.
   - `next.config.ts` теперь загружает `.env` из корня монорепо (ручной
     парсер, ~30 строк), плюс `transpilePackages: ["@alias/shared"]` —
     чтобы Turbopack транспилировал TS из shared.
   - `lib/prisma.ts` импортирует `PrismaClient` из
     `@alias/shared/generated/prisma`.

5. **`apps/ws/`** — пустой пакет-заглушка `@alias/ws` с одним
   `package.json`. Заполнится в следующем этапе.

6. **`.gitignore`** обновлён: путь к генератору Prisma теперь
   `packages/shared/src/generated/prisma/`, добавлены `node_modules/`
   и `**/.next/`.

#### Полировка локального режима

1. **Pause-модалка** (`/local/[id]/round`):
   - Кнопка `Пауза` в хедере (иконка `Pause` из lucide) теперь
     открывает full-screen overlay с blur'ом фона.
   - В оверлее: статистика «N/M угадано · 00:XX осталось», кнопки
     `Продолжить` (primary) и `Завершить раунд` (danger).
   - Завершить досрочно = тот же путь, что и истечение таймера
     (`handleTimeUp` — если текущее слово открыто, оно фиксируется как
     пропуск).

2. **Переключатель темы** в `Header` (`ThemeToggle.tsx`):
   - Сохранение в `localStorage.alias.theme`. По умолчанию — `prefers-color-scheme`.
   - Инициализация ДО гидратации через inline-script в `layout.tsx`
     (`<head><script dangerouslySetInnerHTML />`) → нет «вспышки»
     темной/светлой темы при первом рендере.
   - Иконка `Sun`/`Moon` из lucide.

3. **lucide-react** подключён, заменены ключевые inline-SVG/символы:
   - Home: `Wifi`/`Smartphone` вместо самописных SVG, `Check` в
     bullet-points.
   - Round: `Pause`, `X`, `Check` в action-bar и round summary.
   - HistoryRow: `ArrowRight` в «Продолжить», `Trash2` в удалении,
     `Crown` у победителя.
   - Results: `Trophy` вместо эмодзи 🏆.

### Проверка

`tsc --noEmit` чистый в `apps/web`. Smoke через dev-сервер:
- `npm run dev` (из корня) поднимает Next на :3000 через workspace.
- `.env` из корня подхватывается, Neon отвечает.
- `/`, `/api/categories`, `/api/stats`, `/local/new` все отдают 200.
- Cookie `aid` ставится proxy.ts.

### Где остановились

Монорепо живой, локальный режим отполирован. Готовы к **Этапу 2 —
онлайн**: пользователь параллельно регистрирует Upstash Redis и
Railway. Дальше:
1. WS-сервер в `apps/ws/` (Node + Socket.io + ioredis + Prisma).
2. REST-эндпоинты для комнат в `apps/web/src/app/api/rooms/`.
3. Общие WS-события (`packages/shared/src/socket-events.ts`).
4. UI: `/join`, `/room/[code]`, `/room/[code]/play`.

### Важные нюансы монорепо, замеченные тут

- **`.env` живёт только в корне.** `prisma` CLI читает его из cwd
  (корень), Next.js — через ручной парсер в `next.config.ts`. Один
  источник истины, ничего не дублируется.
- **`prisma` остаётся в корне**, путь `output` в schema —
  `../packages/shared/src/generated/prisma`. После любого изменения
  schema нужно `npm run db:generate` из корня.
- **`@alias/shared` экспортирует TS-источники**, без сборки. Это
  работает потому что Next 16 / `tsx` / TypeScript-сервер VS Code
  понимают TS-импорты напрямую. Если в WS-сервере понадобится Node
  без транспайлера — придётся добавить tsc-сборку shared, но пока нет.
- **lucide-react** в `apps/web/package.json`. Импортируется
  по-обычному `import { Wifi } from "lucide-react"`, tree-shaking
  заботится сам Next.

### Долг / TODO

- При деплое (Этап 4) убедиться, что Vercel правильно билдит монорепо.
  Корневой `package.json` уже передаёт сборку в `@alias/web`. На
  Vercel нужно будет указать **Root Directory: `apps/web`** или
  оставить корень и поправить `build` команду — решим при деплое.
- WS-сервер на Railway будет указывать на `apps/ws/` через
  Railway-конфиг (Procfile или service config).
- `package.json#prisma.seed` — Prisma 7 хочет `prisma.config.ts`,
  миграцию отложили.

---

## 2026-05-08 · Сессия 3: история игр на главной

### Что сделано

1. **`GET /api/stats`** — агрегаты по cookie `aid`: количество игр,
   количество угаданных слов, success-rate (`guessed / total answered`).
   Пустые значения, если cookie ещё нет.

2. **`HistoryRow` компонент** (`src/components/home/HistoryRow.tsx`) —
   карточка игры по дизайну DESIGN.md §5.1: pill `LIVE`/`DONE`,
   дата, кнопки `Продолжить →` (только для IN_PROGRESS) и удаления,
   список команд с цветными точками (`teamColorVar`), победитель —
   accent-цвет + 👑.

3. **Главная (`/`)** перерисована:
   - Подтягивает `GET /api/games` + `GET /api/stats` через `useEffect`.
   - Stats-strip (3 карточки: «Игр / Слов угадано / Успех %»),
     показывается только если есть хотя бы 1 игра.
   - Список `HistoryRow`'ов с пустым состоянием «Здесь появятся ваши
     недавние игры».
   - Удаление через `DELETE /api/games/[id]` с `confirm()` и
     оптимистичным апдейтом.
   - Mode toggle: онлайн помечен бэйджем `Скоро`, CTA для онлайна
     заменён на placeholder «Онлайн-режим скоро появится» (чтобы не
     вёл на пока несуществующий `/room/new`). Дефолтный mode — offline.

### Проверка

`tsc --noEmit` чистый. Smoke через curl: cookie ставится, создание игры
повышает `stats.games` до 1, `GET /api/games` возвращает её с командами,
`DELETE /api/games/[id]` отвечает 204.

### Где остановились

Главная теперь живая. UI/UX-полировка локального режима и онлайн —
впереди (см. предыдущую сессию).

### Следующий шаг

Что-то из мелочей (по выбору пользователя), все делаются за одну
короткую сессию:

- **Pause-modal** на `/local/[id]/round` — сейчас кнопка просто ставит
  таймер на паузу без диалога, нужен модал «Продолжить / Завершить
  раунд» как в дизайне §5.9.
- **Звук конца раунда** — порт `public/sounds/timer-end.mp3` из старого
  проекта + воспроизведение в момент `onTimeUp`.
- **Тёмная/светлая тема** — toggle в `Header`, сохранение выбора в
  `localStorage`, инициализация через inline-script (без flash на
  загрузке).

После полировки — Вариант 2 из переписки: онлайн (Upstash Redis +
Railway WS-сервер).

---

## 2026-05-08 · Сессия 2: локальный режим end-to-end

### Что сделано

1. **Neon подключён.** В `.env` — `DATABASE_URL` от Neon (pooled). Миграция
   `init` (`prisma/migrations/20260507213022_init/`) применена против Neon,
   клиент сгенерирован в `src/generated/prisma/`.

2. **Seed (`prisma/seed.ts`).** Перенесены все слова из старого
   `alias-game/prisma/seed.ts` (10 категорий, 629 слов), к каждой
   категории добавлен `emoji`, всем словам `difficulty=1`. Конфиг seed —
   через `package.json#prisma.seed`. Запуск: `npm run db:seed`.

3. **`package.json` — скрипты и tsx.** Добавлены `db:migrate`, `db:seed`,
   `db:studio`. Добавлен `tsx` (devDep) — нужен для запуска `seed.ts`.

4. **Идентификация (`PROMPT.md §2.6.4`).** Заменена на cookie-based
   подход через **`src/proxy.ts`** (в Next.js 16 `middleware` →
   `proxy`, см. ниже). Proxy ставит httpOnly-cookie `aid` (UUID) на 1
   год при первом запросе, без обращения к БД. Помощник
   `src/lib/identity.ts` (`requireUserId`, `ensureUser`) резолвит cookie
   в роутах и при необходимости создаёт `User`.

5. **`src/lib/prisma.ts`** — singleton, импорт **из
   `@/generated/prisma/client`** (новый Prisma 6 generator), не из
   `@prisma/client`.

6. **`src/constants/game.ts` + `src/types/index.ts`** — единый источник
   констант (см. PROMPT.md §2.6.7) и DTO для API.

7. **UI-компоненты `src/components/ui/`** — Button, Card, Pill, Chip,
   Toggle, Input, Stepper, Header. Стили — через design-tokens
   (CSS-переменные из `globals.css`), без отдельного CSS-файла классов.

8. **REST API (`PROMPT.md §2.3`):**
   - `GET /api/categories` — список публичных категорий с `_count.words`.
   - `GET /api/games`, `POST /api/games` — список и создание локальных
     игр (валидация ≥2 команд, 2..6 игроков, ≥1 категории, владельцем
     ставится `userId` из cookie `aid`).
   - `GET /api/games/[id]?includeRounds=...`, `DELETE /api/games/[id]` —
     с проверкой `ownerKey === userId`.
   - `GET /api/games/[id]/words` — пакет 50 неиспользованных слов
     (`NOT EXISTS` через Prisma `roundWords.some`).
   - `POST /api/games/[id]/rounds` — финализация раунда: счёт по
     формуле `guessed - (penaltySkip ? skipped : 0)`, ротация команды,
     проверка победы только в конце цикла, FINISHED при `winScore≥`.

9. **UI экраны:**
   - `/local/new` — TeamsScreen (Stepper(1), 2..6 команд по 2..6 игроков,
     цвета команд через `--team-N`).
   - `/local/settings` — SettingsScreen (Stepper(2), chips для времени и
     очков, Toggle штрафа, grid категорий с эмодзи и счётчиком).
   - `/local/[id]/turn` — PassDevice (передача устройства).
   - `/local/[id]/round` — игровой экран (BigTimer, WordCard, ActionBar,
     RoundSummary с правкой статусов).
   - `/local/[id]/results` — VictoryScreen + финальный счёт.

10. **`useTimer`** перенесён из старого проекта (без изменений).
    Состояние setup сохраняется в `sessionStorage`
    (`src/lib/local-setup.ts`) — пользователь может ходить туда-сюда
    между шагами без потери данных.

### Где остановились

**Локальный режим работает end-to-end.** Прошёл smoke-тест через curl:
создать игру → получить пакет слов → отправить раунд → прочитать игру с
раундами. UI-страницы готовы, типизация чистая (`tsc --noEmit` без
ошибок).

### Следующий шаг

Онлайн-режим (по приоритету):

1. **Главная страница (`/`)** — допилить под новый дизайн с историей игр
   и live-статистикой (сейчас placeholder).
2. **`/join`** — ввод кода комнаты, prefill `displayName`.
3. **`POST /api/rooms`, `POST /api/rooms/[code]/join`** — создание и вход
   в комнату (REST). На этом этапе ещё без WS.
4. **Socket.io сервер** (`apps/ws/`) — выделить как монорепо-пакет
   (`apps/web` + `apps/ws` + `packages/shared`), подключить Redis
   (Upstash). Реализовать lobby-события (join/leave/team-edit/start).
5. **Игровой цикл онлайн** — PRE_ROUND → ROUND_ACTIVE → ROUND_REVIEW →
   BETWEEN_ROUNDS → FINISHED, серверный таймер, server-driven `tick`.

Перед началом онлайна — нужно закупить Upstash Redis + Railway-проект
(см. PROMPT.md §2.1.1).

### Важные нюансы Next.js 16, замеченные в этой сессии

- **`middleware.ts` → `proxy.ts`** (deprecated в v16). API
  `NextRequest`/`NextResponse` тот же; cookie-методы те же. Файл лежит
  в `src/proxy.ts`, см. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- В **Route Handlers** `params` — это **Promise**, контекст —
  `{ params: Promise<{ id: string }> }`, нужно `await params`.
  Также есть глобальный helper `RouteContext<'/api/games/[id]'>`.
- `cookies()` из `next/headers` — **async**, требует `await`.
- Импорт Prisma **только** через `@/generated/prisma/client` (новый
  generator положил клиент в `src/generated/prisma/client.ts`), не через
  `@prisma/client` — иначе `Cannot find module`.

### Долг / TODO

- `package.json#prisma.seed` — Prisma 7 хочет `prisma.config.ts`.
  Сейчас работает с warn'ом, мигрировать когда дойдём до Prisma 7.
- Звук конца раунда (`/sounds/timer-end.mp3`) — не подключён, в старом
  проекте был. Перенести при доводке UX.
- `lucide-react` так и не подключён; пока inline-SVG/эмодзи. Подключить
  при общей доводке UI/иконок.
- Главная страница (`/`) пока без истории игр и stats-strip (см. TODO выше).
- Online-режим (`Room`, `Participant`, WS, Redis) — целиком впереди.

---

## 2026-05-05 · Сессия 1: фундамент (schema + tokens + home)

### Что сделано

1. **`prisma/schema.prisma`** — расширен полностью по `PROMPT.md §2.2.1`.
   Добавлены модели: `User`, `Room`, `RoomCategory`, `Participant`,
   расширены `Game` (mode, ownerKey, roomId), `Team` (color), `Player`
   (userId), `Round` (startedAt/endedAt), `RoundWord` (order). Enum'ы:
   `RoomStatus`, `ParticipantRole`, `GameMode`, `GameStatus`. Поля
   `Category.emoji`/`isPublic`, `Word.difficulty`. Используется новый
   генератор Prisma 6 (`provider = "prisma-client"`, output в
   `src/generated/prisma`).

2. **`src/app/globals.css`** — перенесены все дизайн-токены из
   `DESIGN.md §2`: поверхности, текст, акцент (mint OKLCH), палитра
   команд (`--team-1..6`), статусы, радиусы, типографика, тени, density.
   Добавлена светлая тема (`[data-theme="light"]`), классы типографики
   (`.h-display`, `.h-mega`, `.h-title`, `.eyebrow`) и `.pulse`-анимация.
   Tailwind 4 `@theme inline` мапит CSS-переменные в utility-классы.

3. **`src/app/layout.tsx`** — заменены шрифты на **Manrope** (sans) и
   **JetBrains Mono** (mono) из `next/font/google`, как в дизайне.
   Подкючена `cyrillic` подгруппа. `<html>` получил `lang="ru"` и
   `data-density="cozy"`.

4. **`src/app/page.tsx`** — главная страница (HomeScreen):
   hero c заголовком в стиле дизайна (3 строки, средняя — accent),
   mode toggle с двумя `ModeCard` (online/offline) с radial-glow на
   активном, CTA-кнопки (`Создать комнату` / `Войти по коду` для online,
   `Новая игра` для offline), история игр — placeholder.

### Где остановились

Готов **только фундамент**: схема БД, дизайн-токены, главная.
Бэкенд (API), онлайн-режим (WS), все остальные экраны и компоненты —
**не сделаны**.

### Следующий шаг (приоритет в порядке убывания)

1. **Миграция и сид.** Сделать `prisma migrate dev --name init` против
   локального Prisma Postgres (URL уже в `.env`). Написать
   `prisma/seed.ts` — категории с эмодзи + слова с `difficulty=1`
   (использовать данные из `alias-game/prisma/seed.ts` старого проекта,
   если есть, иначе минимальный набор для разработки).

2. **`src/lib/prisma.ts`** — singleton Prisma client (импорт из
   `src/generated/prisma`, не из `@prisma/client`!).

3. **`src/lib/identity.ts`** + **middleware** — анонимный `aid` cookie
   (см. `PROMPT.md §2.6.4`). На каждом запросе к API: если cookie нет —
   создаём `User`, ставим cookie. Это база и для local, и для online.

4. **API: `GET /api/categories`** — простейший endpoint, нужен и для
   setup-экрана, и чтобы убедиться что Prisma подключена.

5. **Setup flow (LOCAL)**:
   - `src/app/local/new/page.tsx` — Stepper(1), редактор команд (см.
     `DESIGN.md §5.2 TeamsScreen`).
   - `src/app/local/settings/page.tsx` — Stepper(2), время/очки/штраф/
     категории (`SettingsScreen`).
   - `POST /api/games` (mode=LOCAL) — создание локальной игры.

6. **UI-компоненты** (`src/components/ui/*`) — извлечь повторяющиеся:
   `Button`, `Card`, `Pill`, `Chip`, `Toggle`, `Input`, `Stepper`,
   `Header` (тот, что сейчас inline в `page.tsx`).

7. **Локальная игра — игровой цикл**: `turn` → `round` → `results`.
   Только после этого браться за онлайн (Room/WS/Redis).

### Долг / TODO позднее

- `package.json`: добавить `lucide-react` (используется в дизайне),
  `qrcode` (для лобби), `socket.io-client` (для WS позже),
  `cookies-next` или работа через `next/headers`.
- Решить: монорепо (`apps/web` + `apps/ws` + `packages/shared`) как в
  ТЗ §2.1.3, или один пакет на старте + выделение позже. Пока — один
  пакет (быстрее итерации).
- Seed-скрипт: `package.json` нужно дополнить `"prisma": { "seed": "tsx prisma/seed.ts" }`.

### Важные нюансы из ТЗ, чтобы не забыть

- В `AGENTS.md`: «This is NOT the Next.js you know» — Next 16.2.4 + React
  19.2.4. Перед написанием API-роутов / middleware читать
  `node_modules/next/dist/docs/`.
- Prisma 6: `import { PrismaClient } from "../generated/prisma"`, не из
  `@prisma/client`.
- `DATABASE_URL` в `.env` — `prisma+postgres://localhost:51213/...` (это
  локальный Prisma Postgres, запускается `prisma dev`).
- Идентификация **только** через httpOnly-cookie `aid`, никаких
  `sessionId` в body/query (`PROMPT.md §2.3`).
- Реакции (🔥🤔😂👏) и чат **исключены** из v2 (`PROMPT.md §2.7`).
