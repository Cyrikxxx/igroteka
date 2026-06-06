# Handoff: Alias Online — Redesign (все экраны + мобайл)

## Overview
Полный редизайн игры **Alias Online** (объясни слово, не называя). Два режима — **онлайн**
(каждый со своего телефона, реалтайм) и **локально** (одно устройство по кругу). В пакете —
**14 экранов** в тёмной и светлой теме, со сквозной адаптивностью (мобайл → 2560).

Цель задачи: **воспроизвести эти дизайны в реальном приложении** `apps/web`
(Next.js App Router + React + Tailwind CSS v4), заменив текущий старый UI.

## About the design files
Файлы в `src/` — это **дизайн-референс, собранный на HTML/React+CSS**. Это прототип,
показывающий итоговый вид и поведение, **а не продакшн-код для прямого копирования**.
Прототип намеренно построен так, чтобы лечь на ваш стек с минимумом переписывания
(см. «Стратегия переноса»). Источник правды по версткам, отступам и копирайту — **код в `src/`**;
README описывает структуру, маршруты и маппинги.

Быстрый предпросмотр всех экранов целиком: откройте `preview/Alias-Online-standalone.html`
в браузере — это самодостаточный bundle с переключателем экранов и тем (верхняя панель
«экраны» — это **строительные леса прототипа, в продакшн не переносятся**).

## Fidelity
**High-fidelity.** Финальные цвета, типографика, отступы, состояния и микроанимации.
Воспроизводить **пиксель-в-пиксель**, опираясь на код в `src/`.

---

## Стратегия переноса (самый быстрый путь)

Прототип уже использует **ваши дизайн-токены как CSS-переменные** и **семантические классы**
(`.btn`, `.card`, `.team-card`, `.word-card-big`…), а не «магические» числа. Поэтому
рекомендуемый путь — перенести стили как **слой компонентов**, а не перебивать всё в
Tailwind-утилиты.

1. **Токены.** Большинство токенов уже есть в `apps/web/src/app/globals.css`. Допишите
   расширения из `src/app.css` (`:root`): `--accent-2`, `--r-2xl`, и fluid-ритм
   `--gap`, `--shell-w`, `--section-y`, `--pad-card` (все на `clamp()`). Светлая тема —
   блок `[data-theme="light"]`.
2. **Компонентные классы.** Перенесите содержимое `src/app.css` + `src/screens.css`
   в `globals.css` внутри `@layer components { … }`. Это даёт точный результат сразу;
   Tailwind-утилитами тюньте точечно поверх.
3. **Экраны → роуты.** Каждый компонент из `src/screen-*.jsx` — почти готовый client-компонент.
   По каждому: добавить `"use client"`, убрать прототипную обвязку (`proto-bar` и проп `go()`),
   заменить `go("...")` на навигацию Next (`<Link>` / `useRouter().push`).
4. **Иконки** — самодельный `<Icon name="…"/>` заменить на `lucide-react` (таблица ниже).
5. **Шрифты** — `next/font/google`: `Manrope` (400–900) + `JetBrains_Mono`; повесить
   переменные на `<html>`, они подхватятся в `--font-sans` / `--font-mono`.
6. **Тема** — переключатель уже работает через `data-theme` на корне. Подойдёт `next-themes`
   с `attribute="data-theme"`, CSS трогать не нужно.

### Что НЕ переписывать в утилиты
`code-chunk`, `word-card-big`, `timer-ring` (SVG-кольцо таймера), `podium`, `team-card`,
countdown `cd-num` — сложная геометрия, в утилитах станет нечитаемой. Оставить классами.

---

## Экраны → маршруты

| # | Экран (компонент в `src/`) | Маршрут в `apps/web` | Режим |
|---|---|---|---|
| 1 | `HomeScreen` (screen-home) | `/` | общий |
| 2 | `HistoryScreen` (screen-history) | `/history` | общий |
| 3 | `JoinScreen` (screen-online) | `/join` | онлайн |
| 4 | `CreateRoomScreen` (screen-online) | `/room/new` | онлайн |
| 5 | `LobbyScreen role="host"` (screen-online) | `/room/[code]` (хост) | онлайн |
| 6 | `LobbyScreen role="guest"` (screen-online) | `/room/[code]` (участник) | онлайн |
| 7 | `TeamsScreen` (screen-local) | `/local/new` | локально |
| 8 | `SettingsScreen` (screen-local) | `/local/settings` | локально |
| 9 | `PassScreen` (screen-local) | `/local/[id]/turn` | локально |
| 10 | `GameScreen role="explainer"` (screen-game) | `/local/[id]/round`, `/room/[code]/play` | оба |
| 11 | `GameScreen role="guesser"` (screen-game) | `/room/[code]/play` | онлайн |
| 12 | `GameScreen role="spectator"` (screen-game) | `/room/[code]/play` | онлайн |
| 13 | `RoundSummary` (screen-game) | часть `/local/[id]/round` и онлайн-цикла | оба |
| 14 | `Victory` (screen-game) | `/results/[gameId]`, `/local/[id]/results` | оба |

**Состояния/оверлеи внутри игры:**
- **PRE_ROUND** — компонент `Countdown` (отсчёт 3-2-1 → GO) показывается оверлеем при старте
  раунда, пока `phase === "pre"`; затем `ROUND_ACTIVE`. По таймауту `→ RoundSummary`.
- **Пауза** — оверлей `.pause-overlay` внутри `GameScreen` (только у explainer): таймер заморожен,
  «Продолжить» / «Завершить».

### Приватность ролей (критично, онлайн)
- **explainer** — видит слово (`.word-card-big`), мега-таймер, нижняя `.action-bar`
  «пропустил / угадал». Слово **видит только он**.
- **guesser** — видит «кто объясняет», таймер, счётчики, но **не слово** (карточка `.guesser-card`,
  бейдж «слово скрыто»).
- **spectator** — как guesser, но без участия (иконка `eyeOff`, без кнопки спора).

---

## Компоненты-атомы (в `src/common.jsx`)
Переиспользуемые, стоит вынести в `apps/web/src/components/`:
- `Brand`, `AppHeader`, `ThemeToggle`
- `Avatar` — инициалы на цветном круге (`team` 1–6 → `--team-N`); точка «онлайн» через `online`.
  **Аватарок-картинок нет** — только инициалы.
- `RoomCode` — код комнаты крупными ячейками (`.code-chunk`, 6 символов, напр. `VPYZQQ`).
- `QrCode` — детерминированный QR-подобный SVG (декоративный, но стабильный по `value`).
  В проде замените на реальный QR-генератор (напр. `qrcode.react`).
- `useCountUp(target, dur)` — анимированный счётчик (через `setInterval`, не rAF).
- `CATEGORIES` — 10 категорий с эмодзи и числом слов.

## Иконки: `Icon name` → `lucide-react`
Замена механическая (camelCase → PascalCase). Где имя отличается:

| name (прототип) | lucide-react | | name | lucide-react |
|---|---|---|---|---|
| wifi | `Wifi` | | refresh | `RefreshCw` |
| smartphone | `Smartphone` | | qr | `QrCode` |
| users / user | `Users` / `User` | | copy | `Copy` |
| clock | `Clock` | | share | `Share` |
| check / x | `Check` / `X` | | chevronRight | `ChevronRight` |
| play / pause | `Play` / `Pause` | | sparkles | `Sparkles` |
| trophy / crown | `Trophy` / `Crown` | | hash | `Hash` |
| plus / minus | `Plus` / `Minus` | | dice | `Dice5` |
| arrowRight / arrowLeft | `ArrowRight` / `ArrowLeft` | | link | `Link2` |
| settings | `Settings` | | logout | `LogOut` |
| trash | `Trash2` | | edit | `Pencil` |
| star / target / zap | `Star` / `Target` / `Zap` | | eyeOff | `EyeOff` |
| message | `MessageCircle` | | forward | `SkipForward` |
| flag | `Flag` | | sun / moon | `Sun` / `Moon` |

---

## Design tokens (справочно — основа в вашем `globals.css`)
- **Поверхности:** `--bg`, `--bg-1…4`, `--bg-top`, `--line`, `--line-strong`.
- **Текст:** `--fg`, `--fg-1…4`.
- **Акцент (mint):** `--accent: oklch(0.80 0.16 165)`, `--accent-2`, `--accent-soft`,
  `--accent-line`, `--accent-fg`, `--glow`.
- **Команды (6, одна светлота/насыщенность, меняется hue):** `--team-1` mint 165,
  `--team-2` amber 55, `--team-3` violet 285, `--team-4` sky 235, `--team-5` rose 12,
  `--team-6` lime 120.
- **Статусы:** `--success` (=accent), `--warn` (amber), `--danger` `oklch(0.66 0.20 25)`.
- **Радиусы:** `--r-xs 8 / --r-sm 12 / --r-md 16 / --r-lg 22 / --r-xl 30 / --r-2xl 40`.
- **Тени:** `--shadow-card`, `--shadow-pop`, `--glow`.
- **Типографика:** классы `.h-mega / .h-display / .h-title / .h-sub / .eyebrow`,
  заголовки на `clamp()` (текучие), вес 800–900, отрицательный letter-spacing.
- **Шрифты:** `--font-sans` Manrope, `--font-mono` JetBrains Mono.

## Адаптивность
- Контейнер `.shell` растёт по брейкпоинтам: `--shell-w` 1240 → 1480 (≥1600) → 1680 (≥1920)
  → 2080 (≥2560). Так контент не «мельчает» и не оставляет пустоты на больших экранах.
- Типографика и отступы — на `clamp(min, vw, max)`; на мобайле берут min-значения.
- Мобильный слой — `@media (max-width: 640px / 430px)` в конце `app.css` и `screens.css`:
  футеры лобби/настроек встают в столбик, шапка ужимается (история → иконка), крупные
  счётчики игры сжимаются. Проверено на 390px без горизонтального переполнения.
- Тап-зоны кнопок ≥46px (см. `.btn` clamp).

## Данные: реальное vs плейсхолдеры
- ✅ Реальное: 10 категорий / 629 слов; команды с цветами (до 6); код комнаты 6 символов;
  счёт/раунды; режимы online/local; тёмная/светлая тема.
- ⚠️ Плейсхолдеры (не выдавать за «настоящее»): статистика истории (48 игр, 1247 слов, 73%),
  список партий, «5–32 игрока». Намеренно **убраны**: счётчик «online», каталог публичных
  комнат, звук/эмодзи-реакции, регистрация/профили.

## Files
- `src/Alias Online - Redesign.html` — точка входа прототипа (роутер по `screen`-стейту, темы).
- `src/app.css` — токены + базовые компоненты (кнопки, карточки, инпуты, пилюли, аватары,
  code-chunk, чипы, тоглы, типографика) + мобильный слой.
- `src/screens.css` — поэкранные верстки (home, history, lobby, setup, game, summary, victory,
  pass, countdown) + мобильный слой.
- `src/common.jsx` — атомы: Icon, Brand, AppHeader, ThemeToggle, Avatar, RoomCode, QrCode,
  useCountUp, CATEGORIES.
- `src/screen-home.jsx` — Главная (hero, 3 CTA).
- `src/screen-history.jsx` — История игр (статы + список партий, LIVE/завершена, фильтры).
- `src/screen-online.jsx` — Join, CreateRoom, Lobby (host/guest).
- `src/screen-local.jsx` — Teams (шаг 1), Settings (шаг 2), Pass (передача устройства), Steps.
- `src/screen-game.jsx` — GameScreen (3 роли + PRE_ROUND + пауза), RoundSummary, Victory, TimerRing.
- `preview/Alias-Online-standalone.html` — самодостаточный bundle для предпросмотра всех экранов.
