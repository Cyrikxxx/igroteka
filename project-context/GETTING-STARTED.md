# Запуск проекта локально

Полный путь от чистой машины до работающего сайта на `localhost`. Прод живёт
отдельно и локальной разработкой не затрагивается — см.
[DEPLOYMENT.md](DEPLOYMENT.md).

---

## Что нужно

| | Версия | Зачем |
|---|---|---|
| **Node.js** | 22 или новее | оба приложения |
| **npm** | 10+ | идёт с Node; проект на npm workspaces |
| **Docker Desktop** | любая свежая | Postgres и Redis в контейнерах |

Ставить Postgres и Redis на машину не нужно — они поднимаются в Docker и
удаляются одной командой.

---

## Первый запуск

```bash
git clone https://github.com/Cyrikxxx/alias-online.git
cd alias-online
npm install

cp .env.example .env      # значения по умолчанию уже рабочие
npm run setup:local       # базы + миграции + словарь
npm run dev               # web :3000 + ws :3001
```

Открыть **http://localhost:3000**.

`setup:local` делает три вещи: поднимает контейнеры и **дожидается**, пока они
станут healthy, применяет миграции, заливает словарь. Это `db:up`, `db:deploy`
и `db:seed` подряд — их можно вызывать и по отдельности.

> **Docker Desktop должен быть запущен.** Если в трее кит ещё мигает, `db:up`
> упадёт с `cannot find the file specified` — подождите и повторите.

---

## Переменные окружения

Локально хватает `.env.example` как есть. Что в нём:

| Переменная | Зачем | Локальное значение |
|---|---|---|
| `DATABASE_URL` | Postgres | `postgresql://alias:alias@localhost:5432/alias?schema=public` |
| `REDIS_URL` | Redis | `redis://localhost:6379` |
| `WS_TOKEN_SECRET` | подпись WS-токенов **и куки `aid`** | любая длинная строка |
| `NEXT_PUBLIC_WS_URL` | адрес ws для браузера | `http://localhost:3001` |

`WS_TOKEN_SECRET` обязателен: без него web и ws падают на старте, и это
сделано намеренно — приложение с дефолтным секретом выглядит рабочим, а на деле
открыто. Сгенерировать свой:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Значение должно быть **байт в байт одинаковым** у web и ws. Здесь это один файл
`.env` в корне, так что разойтись негде.

---

## Повседневные команды

| Команда | Что делает |
|---|---|
| `npm run dev` | web и ws одновременно, с раздельными цветами в логах |
| `npm run check` | типы + линт + тесты — то же, что гоняется перед коммитом |
| `npm test` | только тесты |
| `npm run build` | прод-сборка Next |
| `npm run db:studio` | Prisma Studio: смотреть и править базу глазами |
| `npm run db:migrate` | новая миграция после правки схемы |
| `npm run db:up` / `db:down` | поднять и остановить базы |

Полный список — в [TESTING.md](TESTING.md) и в `package.json`.

---

## Играть с телефона по локальной сети

Полезно: обе игры про несколько устройств, и в браузере это не проверить.

1. Узнать IP компьютера в сети — `ipconfig` (Windows) или `ifconfig` (mac/Linux),
   строка вида `192.168.1.5`.
2. Открыть на телефоне `http://192.168.1.5:3000`.

Настраивать ничего не нужно: `allowedDevOrigins` в
[`next.config.ts`](../apps/web/next.config.ts) уже разрешает приватные
диапазоны, а адрес ws подставляется с тем же хостом. Телефон и компьютер должны
быть в одной сети, и firewall не должен резать порты 3000/3001.

---

## Что где лежит

```
apps/web      Next.js: страницы и REST API
apps/ws       Socket.io: реалтайм обеих игр
packages/shared   типы, токены, клиенты БД — общее для web и ws
prisma        схема, миграции, словарь
```

Подробнее — в [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Если что-то не работает

**`db:up` падает с `cannot find the file specified`**
Docker Desktop не запущен или ещё стартует.

**`WS_TOKEN_SECRET не задан`**
Нет файла `.env` — скопируйте `.env.example`.

**Сайт открывается, но комнаты не создаются**
Не применены миграции: `npm run db:deploy`.

**В категориях пусто**
Не залит словарь: `npm run db:seed`.

**`EPERM` при сборке на Windows**
Запущен `npm run dev` и держит DLL Prisma. Остановите его перед `npm run build`.

**Начать базу с нуля**
```bash
npm run db:down     # добавить -v, чтобы стереть и данные
npm run setup:local
```
