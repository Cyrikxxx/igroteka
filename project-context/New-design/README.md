# Handoff: Alias Online — редизайн

## Overview

Этот пакет — материалы для редизайна **существующего работающего**
сайта Alias Online (онлайн-«Алиас»: слова на время, командами, по сети
или передавая телефон).

`Alias Online - Bold.html` — **визуальный референс** (не production-код).
Открой в браузере, смотри по разделам Design Canvas. Все стили — в
`<style>` вверху файла, это источник правды по визуалу.

> ⚠️ **Важно.** Проект уже задеплоен и работает (Vercel + Railway).
> Этот README в первой редакции содержал выдуманную/неточную
> техническую часть (маршруты, события, структуру). Она **исправлена
> под реальный код**. Дизайн-описания сохранены. Читай раздел
> «Что трогать, что НЕ трогать» перед началом.

---

## 0. Что трогать при редизайне, что НЕ трогать

Проект — **монорепо**. Дизайн живёт **только** в `apps/web/`. Игровая
логика, реалтайм, БД — отдельно и менять их для редизайна **не нужно**.

### ✅ МОЖНО менять (это и есть «дизайн»)

| Что | Где |
|---|---|
| Цвета, шрифты, радиусы, тени, плотность | `apps/web/src/app/globals.css` (блок `:root`) |
| Глобальные тайпо-классы (`.h-display`, `.eyebrow`, `.pulse`) | там же, `globals.css` |
| Переиспользуемые UI-компоненты | `apps/web/src/components/ui/` |
| Компоненты главной | `apps/web/src/components/home/` |
| Вёрстка/стили экранов | `apps/web/src/app/**/page.tsx` (JSX и инлайн-стили) |
| Шрифты | `apps/web/src/app/layout.tsx` |

### 🚫 НЕ трогать (это логика — сломаешь игру)

| Что | Где | Почему |
|---|---|---|
| REST API | `apps/web/src/app/api/**` | бэкенд игры |
| Хуки и клиент-логика | `apps/web/src/hooks/`, `apps/web/src/lib/` | сокеты, состояние комнаты, токены |
| Реалтайм-сервер | `apps/ws/**` | отдельный сервис на Railway |
| Общие типы и события | `packages/shared/**` | контракт между web и ws |
| Схема БД | `prisma/**` | миграции |
| Конфиги деплоя | `vercel.json`, корневой `package.json`, `apps/web/next.config.ts` | CI/CD |

**Правило при редизайне страницы:** меняй только JSX-разметку и стили
внутри `page.tsx`. Импорты хуков (`useRoom`, `useTimer`), вызовы
`socket.emit(...)`, `fetch("/api/...")`, обращения к `snapshot.*` —
**оставляй как есть**, просто перерисовывай вокруг них.

---

## 1. Реальная карта маршрутов

База: `apps/web/src/app/`. Все страницы — `"use client"` (не Server
Components — в первой редакции README было указано неверно).

| Экран макета | Реальный маршрут | Файл |
|---|---|---|
| Главная (выбор режима + история + статистика) | `/` | `app/page.tsx` |
| Войти по коду | `/join` | `app/join/page.tsx` |
| Создать онлайн-комнату (форма) | `/room/new` | `app/room/new/page.tsx` |
| Лобби (хост и участник — **одна** страница, роль из снапшота) | `/room/[code]` | `app/room/[code]/page.tsx` |
| Игровой экран онлайн (все фазы и роли) | `/room/[code]/play` | `app/room/[code]/play/page.tsx` |
| Команды офлайн (шаг 1) | `/local/new` | `app/local/new/page.tsx` |
| Настройки офлайн (шаг 2) | `/local/settings` | `app/local/settings/page.tsx` |
| Передача устройства (между раундами офлайн) | `/local/[id]/turn` | `app/local/[id]/turn/page.tsx` |
| Игровой экран офлайн + итог раунда (модал) | `/local/[id]/round` | `app/local/[id]/round/page.tsx` |
| Итоги офлайн-игры | `/local/[id]/results` | `app/local/[id]/results/page.tsx` |
| Финал партии (общий: online + offline) | `/results/[gameId]` | `app/results/[gameId]/page.tsx` |

**Чего НЕТ как отдельных маршрутов** (в первой редакции было ошибочно):

- **Истории игр** (`/history`) — нет. История и статистика — это
  **секции на главной** `app/page.tsx` (компонент
  `components/home/HistoryRow.tsx`).
- **Итог раунда онлайн** — не отдельный роут. Это **фаза**
  `ROUND_REVIEW` внутри `/room/[code]/play` (см. ниже).
- **Пауза** — не роут. Это модал (`components/ui/Modal.tsx`) поверх
  игрового экрана.
- Маршрутов вида `app/r/[code]/...` нет — правильно `app/room/[code]/...`.

### Роли на игровом экране

В `app/room/[code]/play/page.tsx` роль вычисляется из снапшота, строки
ровно три: **`explainer` | `guesser` | `spectator`**. Отдельной роли
`watcher`/`host` в коде нет — «хост» определяется отдельно
(`creds.userId === snapshot.hostId`) и влияет лишь на доп. контролы.
При редизайне ориентируйся на эти три значения.

### Фазы онлайн-игры (внутри `/room/[code]/play`)

Один компонент рендерит разные виды по `snapshot.phase`:
`PRE_ROUND` (countdown 3-2-1) → `ROUND_ACTIVE` (слово/таймер) →
`ROUND_REVIEW` (итоги раунда, правка) → `BETWEEN_ROUNDS` (анонс
следующего) → `FINISHED` (редирект на `/results/[gameId]`).
Эти подвиды — функции `PreRoundView` / `ActiveRoundView` /
`ReviewView` / `BetweenRoundsView` в том же файле. Их можно
перерисовывать, но не менять условия переключения по `phase`.

---

## 2. Дизайн-система — как реально устроены токены

> ⚠️ **НЕ заменяй `globals.css` блоком из старой редакции этого
> README** (`@theme { --color-bg: ... }`). Это сломает весь сайт:
> компоненты везде используют `var(--bg)`, `var(--accent)`,
> `var(--team-1)` через инлайн-стили. Если переименовать переменные —
> всё станет бесцветным.

Реальная структура `apps/web/src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  /* Поверхности */
  --bg: #0a0d10;  --bg-1: #0e1316;  --bg-2: #131a1e;
  --bg-3: #1a2227; --bg-4: #232c32;
  --line: rgba(255,255,255,0.07);
  --line-strong: rgba(255,255,255,0.14);
  /* Текст */
  --fg: #f1f3f4; --fg-1: #c9cfd2; --fg-2: #8a9499;
  --fg-3: #5b676d; --fg-4: #3a444a;
  /* Акцент (mint) */
  --accent: oklch(0.78 0.16 165);
  --accent-soft: oklch(0.78 0.16 165 / 0.18);
  --accent-line: oklch(0.78 0.16 165 / 0.45);
  --accent-fg: #062017;
  /* Команды */
  --team-1: oklch(0.78 0.16 165); /* ...до --team-6 */
  /* Статусы */
  --success/--warn/--danger
  /* Радиусы --r-xs..--r-xl, шрифты, тени, density */
}

[data-theme="light"] { /* переопределение тех же переменных */ }

@theme inline {
  /* мапит ЧАСТЬ переменных в Tailwind-утилиты (bg-bg-1 и т.п.) */
  --color-bg: var(--bg); /* ... */
}
```

### Как делать редизайн токенов правильно

- **Поменять палитру/радиусы/тени** → меняй **значения** в блоке
  `:root` (и в `[data-theme="light"]`, если правишь светлую тему).
  **Имена переменных не переименовывай** — на них завязан весь код.
- Компоненты применяют токены **двумя способами**: чаще инлайном
  `style={{ background: "var(--bg-1)", color: "var(--accent)" }}`,
  реже Tailwind-классами (`text-fg-2` и т.п. — то, что в `@theme
  inline`). Оба продолжат работать, если менять только значения.
- Глобальные классы (`.h-display`, `.h-title`, `.eyebrow`, `.pulse`)
  тоже в `globals.css` — их можно править/добавлять.

Значения цветов/типографики/радиусов из макета Bold (раздел «Design
tokens — сводка» ниже) — это **то, к чему привести значения в
`:root`**. Имена слева в таблицах — соответствуют существующим
`--bg`, `--fg-2`, `--accent` и т.д.

### Шрифты

Подключены в `apps/web/src/app/layout.tsx` через `next/font/google`
(Manrope + JetBrains Mono), уже как `--font-sans` / `--font-mono`.
Менять — там же.

---

## 3. Design tokens — сводка (значения из макета Bold)

> Это целевые **значения**. Применяй их, меняя `:root` в `globals.css`
> (имена переменных слева — уже существующие в проекте).

### Цвета (dark, базовая тема)

| Переменная в коде | Значение | Использование |
|---|---|---|
| `--bg` | `#0a0d10` | основной фон |
| `--bg-1` | `#0e1316` | карточка |
| `--bg-2` | `#131a1e` | input, secondary btn |
| `--bg-3` | `#1a2227` | подложка pill |
| `--bg-4` | `#232c32` | активный сегмент |
| `--line` | `rgba(255,255,255,0.07)` | hairline |
| `--line-strong` | `rgba(255,255,255,0.14)` | пунктир, focus |
| `--fg` | `#f1f3f4` | основной текст |
| `--fg-1` | `#c9cfd2` | вторичный текст |
| `--fg-2` | `#8a9499` | подписи |
| `--fg-3` | `#5b676d` | placeholder, eyebrow |
| `--fg-4` | `#3a444a` | disabled |
| `--accent` | `oklch(0.78 0.16 165)` | primary CTA |
| `--accent-soft` | accent / 0.18 | tinted bg |
| `--accent-line` | accent / 0.45 | бордер accent-карточек |
| `--accent-fg` | `#062017` | текст на accent |
| `--team-1..6` | `oklch(0.78 0.16 H)` | hues: 165,50,280,230,10,110 |
| `--success` | = accent | |
| `--warn` | `oklch(0.78 0.16 50)` | amber |
| `--danger` | `oklch(0.66 0.20 25)` | ошибки, «Завершить» |

### Радиусы

| Переменная | Value | Где |
|---|---|---|
| `--r-xs` | 6px | сегменты, мелкие чипы |
| `--r-sm` | 10px | sm-кнопка |
| `--r-md` | 14px | базовая кнопка/инпут/карточка |
| `--r-lg` | 18px | lg-кнопка, CTA-карточка |
| `--r-xl` | 26px | hero, large word card |

### Тени

| Переменная | Value |
|---|---|
| `--shadow-card` | `0 1px 0 rgba(255,255,255,.03) inset, 0 6px 20px rgba(0,0,0,.35)` |
| `--shadow-pop` | `0 18px 40px rgba(0,0,0,.55)` |
| `--glow` | `0 0 0 1px var(--accent-line), 0 0 24px oklch(0.78 0.16 165 / .25)` |

### Типографика

Manrope (sans) + JetBrains Mono (коды, таймеры, eyebrow).

| Роль | Family | Weight | Size | Tracking |
|---|---|---|---|---|
| Display hero (desktop) | Manrope | 800–900 | 80–120px | −0.04em |
| Display hero (mobile) | Manrope | 800–900 | 44–64px | −0.04em |
| Title H1 (`.h-display`) | Manrope | 800 | 38–64px | −0.03em |
| Title H2 (`.h-title`) | Manrope | 800 | 22–32px | −0.025em |
| Body | Manrope | 500 | 14px | 0 |
| Caption | Manrope | 500 | 11–12px | 0 |
| Eyebrow (`.eyebrow`) | JetBrains Mono | 500–700 | 9–11px | 0.18em uppercase |
| Code/Mono | JetBrains Mono | 700–800 | 18–48px | 0.14–0.20em |

### Состояния кнопок

Реализованы в `apps/web/src/components/ui/Button.tsx`
(варианты `primary | secondary | ghost | danger`, размеры `sm 34px /
md 44px / lg 54px`). Меняешь стиль кнопок — правишь этот компонент,
не дублируешь стили по экранам.

| Вариант | Default | Active | Disabled |
|---|---|---|---|
| primary | bg=`--accent`, color=`--accent-fg` | translateY(1px) | opacity .5 |
| secondary | bg=`--bg-2`, border=`--line-strong` | translateY(1px) | opacity .5 |
| ghost | transparent | translateY(1px) | opacity .5 |
| danger | bg=`--danger`, color=#fff | translateY(1px) | — |

### Spacing / адаптив

- Breakpoint — Tailwind `md:` (≥768px): десктоп — две колонки,
  мобайл — одна, растянутые CTA.
- Внутренний паддинг карточки 14–22px, gap между карточками 10–28px.
- Десктоп-референс 1280×820, мобайл 390×760.

---

## 4. Экраны (дизайн-описания — сохранены, маршруты исправлены)

> Детали смотри в `Alias Online - Bold.html`. Ниже — функциональное
> описание + что это за файл в реальном проекте.

### Главная — `/` → `app/page.tsx`

Лендинг-точка входа. Mode toggle (две карточки `ModeCard`:
«Локально» / «Онлайн»). CTA меняются под выбранный режим:
online → «Создать комнату» (`/room/new`) + «Войти по коду» (`/join`);
offline → «Новая игра» (`/local/new`). Ниже — stats-strip (3 карточки)
и список истории (`HistoryRow`). Header — компонент
`components/ui/Header.tsx`.

> В макете Bold главная богаче (декоративный «букет» карточек слов,
> стрип публичных комнат). Это можно реализовать как **визуальное
> улучшение** `app/page.tsx`, но публичные комнаты как фича логики —
> вне scope (бэкенда под них нет).

### Войти по коду — `/join` → `app/join/page.tsx`

6 ячеек кода (моно), поле ника, primary «Войти», ghost «На главную».
Код можно префиллить из `?code=` (уже реализовано). QR в макете —
декоративный; реальной QR-библиотеки пока нет (можно добавить как
визуальную фичу, но это уже не «чистый редизайн»).

### Создать комнату — `/room/new` → `app/room/new/page.tsx`

Форма: ник хоста, название, время раунда (chips), очки (chips),
штраф (toggle), категории (grid). На submit → `POST /api/rooms` →
редирект в лобби. **Логику submit не трогать**, перерисовывать форму
можно.

### Лобби — `/room/[code]` → `app/room/[code]/page.tsx`

**Одна** страница и для хоста, и для участника — различия по
`snapshot.hostId === creds.userId`. Слева: команды (`TeamCard` —
gradient под `--team-N`, слоты игроков, корона у хоста). Справа: код
комнаты + кнопки копирования, настройки, «Начать игру» (хост).
Блок зрителей внизу. Реалтайм — через хук `useRoom`
(`apps/web/src/hooks/useRoom.ts`) — **не трогать**, перерисовывать
вокруг `snapshot`.

### Игровой экран онлайн — `/room/[code]/play`

Самый сложный. Фон — accent-glow + dot-pattern. По `snapshot.phase` и
роли (`explainer | guesser | spectator`) рендерятся подвиды:
- **explainer**: accent word-card + action-bar (Пропуск/Угадал) +
  большой моно-таймер; пауза/завершить.
- **guesser**: карточка «X объясняет», без слова.
- **spectator**: то же, eyebrow «ВЫ СМОТРИТЕ».
- **ROUND_REVIEW**: список слов с правкой статусов (у explainer).
- **BETWEEN_ROUNDS**: анонс следующей команды (4 сек).
Пауза — модал. Реконнект-оверлей — модал при потере связи.
Перерисовывать визуал подвидов можно; `socket.emit(...)`,
переключения по `phase`, роль-вычисление — оставлять.

### Локальный режим — `/local/new` → `/local/settings` → `/local/[id]/turn` → `/local/[id]/round` → `/local/[id]/results`

- `/local/new` — редактор команд (Stepper шаг 1).
- `/local/settings` — настройки (Stepper шаг 2).
- `/local/[id]/turn` — «Передайте устройство» между раундами.
- `/local/[id]/round` — игровой экран + модал «Итоги раунда».
- `/local/[id]/results` — финальный счёт.

### Финал — `/results/[gameId]` → `app/results/[gameId]/page.tsx`

Общий для online и offline. Трофей, победитель, финальный счёт по
командам, кнопки «Новая игра/комната» и «На главную».

> Описания макетных экранов «Передача устройства», «Пауза», «Финал»,
> «Итог раунда» из старой редакции — визуально валидны, но это **не
> отдельные роуты**, а страницы/модалы/фазы выше. Редизайнишь их в
> соответствующих файлах.

---

## 5. Общие компоненты (реальные файлы)

| Компонент | Файл | Назначение |
|---|---|---|
| Button | `components/ui/Button.tsx` | 4 варианта, 3 размера |
| Card | `components/ui/Card.tsx` | базовая карточка |
| Pill | `components/ui/Pill.tsx` | чип, моно/live-варианты |
| Chip | `components/ui/Chip.tsx` | выбор времени/очков |
| Toggle | `components/ui/Toggle.tsx` | переключатель |
| Input | `components/ui/Input.tsx` | поле ввода |
| Stepper | `components/ui/Stepper.tsx` | шаги setup |
| Header | `components/ui/Header.tsx` | шапка |
| Modal | `components/ui/Modal.tsx` | пауза, reconnect, confirm |
| ThemeToggle | `components/ui/ThemeToggle.tsx` | свет/тьма |
| HistoryRow | `components/home/HistoryRow.tsx` | карточка игры на главной |

Иконки — в проде через **`lucide-react`** (имена из макета совпадают).
Анимации (`pulse` и т.п.) — keyframes в `globals.css`. Меняешь стиль
кнопки/карточки централизованно в этих компонентах, а не копипастой
по экранам.

---

## 6. Логика — НЕ для редизайна (источник правды, не этот README)

Эти разделы в старой редакции README были **придуманы и не совпадают
с кодом**. Реальные контракты:

- **WebSocket-события** — определены в `packages/shared/src/domain.ts`
  и `apps/ws/src/types.ts` (`room:hello`, `team:create/join/...`,
  `round:start_game`, `round:guess`, `round:pause/resume/end`,
  `round:review_toggle`, `round:review_confirm` и бродкасты
  `room:state`, `round:phase/tick/word/...`). Это **не** `word:got` /
  `game:start` из старого текста.
- **Состояние комнаты** — тип `RoomSnapshot` в
  `packages/shared/src/domain.ts` (не выдуманный `RoomState`).
- **Что в Redis / Postgres**, поток данных, аутентификация токеном —
  описано в `project-context/ARCHITECTURE.md`.

Для **редизайна это всё знать не нужно** — не редактируй эти файлы.
Если кажется, что для визуала надо менять событие/тип — почти всегда
нет: нужное поле уже есть в `snapshot`, просто отобрази его иначе.

---

## 7. Рабочий процесс редизайна

```bash
git checkout -b redesign
npm run dev            # web :3000 + ws :3001, смотришь локально
# правишь globals.css / components/ui/* / app/**/page.tsx
npm run typecheck      # убедиться, что не сломал типы
git add -A && git commit -m "redesign: ..." && git push origin redesign
```

Vercel даст **preview-ссылку** на ветку `redesign` — проверяешь, не
трогая прод. Понравилось → merge в `main` → автодеплой.

Подробно про деплой/архитектуру — `project-context/ARCHITECTURE.md`.

---

## 8. Что НЕ нарисовано в макетах (вне scope редизайна)

Логин/регистрация, профиль, оплата, лидерборд, админка, 404/500,
cookie-баннер — в макете нет, в проекте тоже (anon + ник). Если
понадобится — это новая фича, отдельно от редизайна.

---

## Файлы в пакете

| Файл | Что |
|---|---|
| `README.md` | этот документ (исправлен под реальный код) |
| `Alias Online - Bold.html` | пиксельный референс. Открой в браузере. |
