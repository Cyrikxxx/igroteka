# DESIGN — описание дизайн-системы Alias Online

> Источник: папка `design/` (design canvas).
> Файлы: `Alias Online - Bold.html` (готовая HTML-страница со всеми
> прототипами), `styles.css` (design tokens + утилитарные классы),
> `components/*.jsx` (React-моки экранов), `bold-screens.jsx` /
> `design-canvas.jsx` / `tweaks-panel.jsx` — собственно canvas.
>
> Этот файл — компактный пересказ всего, что нужно знать, чтобы
> воспроизвести UI один-в-один без открытия исходников.

---

## 0. Сверка констант

Числовые лимиты (количество команд, игроков, варианты времени и очков)
**не дублируются здесь** — единый источник истины: `PROMPT.md §2.6.7`
(и зеркало в `packages/shared/constants.ts`). Если в этом файле где-то
встречается число вроде `Users 3/6` или `25/50/75/100` — это иллюстрация,
а не источник; реальное значение брать из `constants.ts`.

---

## 1. Общая стилистика

- **Тема** — тёмная по умолчанию (warm cool ink). Есть переключатель на
  светлую (`[data-theme="light"]`). Палитра не «чёрно-белая»: фоны
  тёплые, акцент — изумрудный mint в OKLCH.
- **Настроение** — «console arcade meets clean SaaS»: моно-шрифт для
  чисел/таймеров/кодов, sans с tight letter-spacing для заголовков,
  asymmetric layouts на главной, edge-to-edge кнопки на игровом
  экране.
- **Плотность** — три варианта `data-density="compact|cozy|roomy"`. По
  умолчанию `cozy` (gap=16, pad=20).

---

## 2. Дизайн-токены (CSS-переменные)

Из `design/styles.css`. Все значения нужно перенести в
`apps/web/src/styles/tokens.css` (или сразу в `globals.css`).

### 2.1. Поверхности (dark default)

```
--bg:        #0a0d10
--bg-1:      #0e1316    (cards)
--bg-2:      #131a1e    (inputs, secondary buttons)
--bg-3:      #1a2227    (chips, kbd)
--bg-4:      #232c32    (utility surface — активное состояние chip/kbd, рамки)
--line:        rgba(255,255,255,0.07)
--line-strong: rgba(255,255,255,0.14)
```

### 2.2. Текст

```
--fg:   #f1f3f4   (primary)
--fg-1: #c9cfd2
--fg-2: #8a9499   (secondary captions)
--fg-3: #5b676d   (tertiary, eyebrows)
--fg-4: #3a444a   (dotted divider)
```

### 2.3. Акцент (mint)

```
--accent:      oklch(0.78 0.16 165)
--accent-soft: oklch(0.78 0.16 165 / 0.18)
--accent-line: oklch(0.78 0.16 165 / 0.45)
--accent-fg:   #062017
```

### 2.4. Палитра команд (одинаковая lightness/chroma, варьируется hue)

```
--team-1: oklch(0.78 0.16 165)   mint
--team-2: oklch(0.78 0.16 50)    amber
--team-3: oklch(0.78 0.16 280)   violet
--team-4: oklch(0.78 0.16 230)   sky
--team-5: oklch(0.78 0.16 10)    rose
--team-6: oklch(0.78 0.16 110)   lime
```

В TS-коде хелпер: `teamColor(n) = var(--team-${((n-1)%6)+1})`.

### 2.5. Статусы

```
--success: oklch(0.78 0.16 165)   (== accent)
--warn:    oklch(0.78 0.16 50)    (amber)
--danger:  oklch(0.66 0.20 25)    (red-ish)
```

### 2.6. Радиусы

```
--r-xs: 6px
--r-sm: 10px
--r-md: 14px
--r-lg: 18px
--r-xl: 26px
--card-r: var(--r-lg)   (зависит от density)
```

### 2.7. Типографика

```
--font-sans: "Manrope", ui-sans-serif, system-ui, "Segoe UI", sans-serif
--font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace

.h-display: 44px / 800 / -0.03em
.h-mega:    80px / 800 / -0.04em / 0.95
.h-title:   28px / 800 / -0.025em
.h-sub:     14px / fg-2
.eyebrow:   11px mono / 0.18em uppercase / fg-3
```

### 2.8. Тени

```
--shadow-card: 0 1px 0 rgba(255,255,255,0.03) inset, 0 6px 20px rgba(0,0,0,0.35)
--shadow-pop:  0 18px 40px rgba(0,0,0,0.55)
--glow:        0 0 0 1px var(--accent-line), 0 0 24px oklch(0.78 0.16 165 / 0.25)
```

### 2.9. Светлая тема (`[data-theme="light"]`)

```
--bg:   #f6f4ee     (warm parchment)
--bg-1: #ffffff
--bg-2: #f0ede4
--bg-3: #e7e3d6
--bg-4: #d8d2c2
--fg:   #0e1316
--fg-2: #5b676d
```

Акцент и `--team-*` остаются те же — OKLCH сохраняет читабельность.

---

## 3. Базовые компоненты (mapping → реализация)

### 3.1. Header (`.app-header`)

- 56px (mobile 48), `bg-1`, нижняя граница `--line`.
- Слева: brand-mark (mint квадратик 28px с иконкой геймпада) + название
  `Alias · online` (mint dot, sub в `--fg-2`).
- Справа: optional `pill` со статусом, optional `pill-mono` с кодом
  комнаты, language-switch (RU/EN, моно), theme-toggle.

### 3.2. Кнопки (`.btn`)

```
.btn        → 44px, radius var(--r-md), font-weight 600
.btn-sm     → 34px / r-sm / 13px
.btn-lg     → 54px / r-lg / 16px

.btn-primary   → bg accent, color accent-fg
.btn-secondary → bg-2 + line border
.btn-ghost     → transparent
.btn-danger    → bg danger, white
.btn-block     → width 100%
```

### 3.3. Карточки (`.card`, `.card-flat`, `.team-card`)

- `.card` — `bg-1`, `--line`, `--card-r`, padding `--pad`, `--shadow-card`.
- `.card-flat` — то же без тени (для лобби, для пустых блоков «Add team»).
- `.team-card` — gradient `team-color → bg-1`, border
  `mix(team-color, line)`, имя команды в team-color. Принимает
  CSS-переменную `--team-color`.

### 3.4. Pills / kbd / eyebrow

- `.pill` — 4×10 padding, radius 999, bg-3, fg-1.
- `.pill-mono` — uppercase моно 10px (для кодов).
- `.pill-success` / `.pill-warn` — окрашенные через `color-mix`.
- `.pill-live` — пульсирующий красный с `<span class="pulse">`.
- `.kbd` — моно 11px, bg-3, в углах `4px`.
- `.eyebrow` — моно 11px / 0.18em / uppercase / fg-3.

### 3.5. Inputs

- `.input` — 42px height, bg-2, line border, r-md, focus → accent ring
  (3px `accent-soft`).

### 3.6. Avatars

- `.avatar` — круг, инициалы (1-2 буквы) на акценте; цвет можно подменить
  на team-color.
- `.avatar-online::after` — зелёная точка bot-right (border 2px `bg-1`).
- `.avatar-stack` — горизонтальный «стек» с `margin-left: -8px` и border
  `bg-1`.

### 3.7. Игровая карточка слова (`.word-card`)

- `bg-1`, 2px accent-line border, radius 24px, padding 60×80, font 56px /
  800 / -0.02em.
- `.word-meta` — моно eyebrow `СЛОВО` сверху по центру, поверх «вырезает»
  фон.
- Тень: `0 0 0 1px accent-soft, 0 24px 60px rgba(0,0,0,.35)`.

### 3.8. ActionBar (`.action-bar` + `.action-btn`)

- absolute bottom, grid 1fr 1fr, height 80px (mobile 72).
- `.skip` — `oklch(0.55 0.20 25)` (red), белый текст.
- `.got`  — accent, accent-fg.
- Иконки (X/Check) 18-20px, font 18px / 700.

### 3.9. Big timer (`.timer-mega` + `.timer-track`)

- Шрифт mono 88-96px (mobile 64-72px), tabular-nums.
- Прогресс-бар: 4px высота, 220-260px ширина, accent.
- В `bold-screens.jsx` есть альтернативная версия — круговой SVG-таймер
  с радиусом 250px и stroke-dasharray.

### 3.10. Toggle (`.toggle`)

- 38×22 пилюля. Track: `--bg-3` в off, `--accent` в `.on`.
- Бегунок («nub») 16px: белый (`#fff` в обеих темах), фиксирован.

### 3.11. Chip (`.chip`)

- 38×* pill с border, при `.on` → accent fill. Используется для выбора
  времени и очков.

### 3.12. Категория (`.cat-card`)

- min-height 64px, padding 12-14, эмодзи 18px в правом верхнем углу
  (opacity .7), название 13/600, моно-счётчик слов 11px/fg-2.
- При `.on` — фон mix(accent 10%, bg-2), border `accent-line`, чек-mark
  14px в правом нижнем углу.

### 3.13. Code chunk (`.code-chunk`)

- inline-flex с `gap: 6px`, моно 700.
- Каждая ячейка — 32×38 (`.lg` версия 52×64), accent text,
  `bg-2` фон, `--line` border, radius 8/12.

### 3.14. QR (`.qr`) — декоративный

В реальном UI заменить на QR через `qrcode`/`react-qr-code`. В дизайне
используется фоновый `conic-gradient` 8×8 + накладные «угловые маркеры».

### 3.15. Stat (`.stat`)

- bg-2, border, padding 14, два текста: `.v` (24/800) + `.l` (моно 11/uppercase/0.1em).

### 3.16. Slot (`.slot`)

- Игрок в команде/лобби: avatar + имя + meta + (опц. crown).
- `.slot.active` — accent border + accent-soft mix-фон.

### 3.17. Word row в RoundSummary (`.word-row`)

- `.word-row.got`  — `mix(accent 10%, bg-1)` + accent border + accent text.
- `.word-row.skip` — то же, но с `--danger`.

### 3.18. Stepper

- Из `screens-setup.jsx` — `Stepper({step})` с тремя метками
  `["Команды", "Настройки", "Старт"]`.
- Каждая «нода» — кружок 22×22, нумерация моно 11/700:
  - **active**: bg accent, color accent-fg.
  - **done**: bg accent-soft, color accent, отметка ✓.
  - **todo**: bg-2, fg-3.
- Между нодами — линия `--line-strong` (на mobile растягивается, скрывая
  подписи).

### 3.19. Прочее

- `.dotted` — пунктирный разделитель (radial-gradient с шагом 6px).
- `.dot-bg` — фон-точки 18px (`radial-gradient(var(--bg-3) 1px, ...)`).
- `.placeholder` — диагональная штриховка (для пустых слотов в моках).
- `.progress` — тонкий прогресс-бар (4px), accent заливка.
- `.speaker-glow` — radial accent-glow сверху (для онлайн-вью спикера).
- Анимация `@keyframes ping` + `.pulse` — пульсирующая точка для LIVE.

---

## 4. Иконки

В моках используется inline-SVG (`Icon`) в стиле Lucide. В реализации —
напрямую `lucide-react` (он уже в `package.json`). Используемые имена:

`controller, plus, play, pause, trash, users, user, crown, trophy,
clock, check, x, arrow-left, arrow-right, settings, wifi, wifi-off,
phone, globe, sun, moon, share, copy, link, qr, eye, skip, home,
refresh, more, lock, sparkle, info, volume, chevron-down`.

(`send` исключён — в v2 нет ни чата, ни реакций, см. PROMPT.md §2.7.)

Все размеры — 12-20px, stroke 2.

---

## 5. Экраны (что в каком файле дизайна и как переносить)

### 5.1. Главная — `screens-home.jsx::HomeScreen`

- Hero: eyebrow → h-display заголовок (3 строки, средняя строка
  `color: var(--accent)`).
- Mode toggle: два `ModeCard`'а — `offline` / `online`. У выбранного:
  border-color → accent, bg → mix(accent 12%, bg-1), absolute radial
  glow в top-right.
- Внутри карточки: иконка (`wifi` или `phone`) в круглом боксе 36px,
  заголовок, подзаголовок fg-2, и список фич (3 пункта с ✓).
- CTA-блок: `[Создать комнату]` (primary lg) + `[Войти по коду]` (secondary lg)
  — для online; `[Новая игра]` — для offline.
- Stats strip: 3× `Stat` (`42 игр`, `1 284 слов`, `68% успешных раундов`).
- История игр: `HistoryRow`'ы — карточка с `pill-live`/`pill-success`,
  `kbd` со временем, `pill-mono` с кодом (если онлайн), action-buttons
  справа (`Продолжить` / `Реванш` / trash), внизу — список команд с
  цветными квадратиками 8×8 и счётом моно (победитель — accent + 👑).

### 5.2. Setup — `screens-setup.jsx::TeamsScreen` и `SettingsScreen`

- **TeamsScreen**: Stepper(1) → `<h1>Команды</h1>` → `<p>` подсказка → grid
  `team-card`'ов (на desktop 2 колонки). Внутри карточки: editable
  `.team-title`, `pill-mono` со счётчиком игроков (`Users N/6` —
  `MAX_PLAYERS_PER_TEAM = 6`, см. PROMPT.md §2.6.7), список `.slot`'ов с
  avatar и кнопкой удаления (icon-btn 26×26). Внизу — `.slot` со
  штриховой границей `+ Добавить игрока`. Отдельная карточка
  `+ Добавить команду` (card-flat dashed border, до 6 команд).
- Внизу: ghost `[← Назад]` + primary `[Дальше: настройки →]` (на mobile —
  стекуются column-reverse, primary растягивается на всю ширину).
- **SettingsScreen**: Stepper(2). Карточки по очереди:
  - **Время раунда**: иконка clock + label, справа `kbd` со значением.
    Внутри — chips 30/45/60/90/120 + `Своё`.
  - **Очки для победы**: то же, варианты 25/50/75/100 + `Своё` (см. `WIN_SCORE_OPTIONS` в PROMPT.md §2.6.7).
  - **Штраф за пропуск**: row-between c title + `.toggle`.
  - **Категории**: title + счётчик «Выбрано N · X слов в банке», справа
    кнопки `Все`/`Очистить`. Grid `cat-card`'ов 2 (mobile) / 3 (desktop)
    колонки. Заблокированные категории (`locked`) — opacity 0.5 + lock
    иконка.

### 5.3. Лобби онлайн — `screens-online.jsx::LobbyOnlineScreen`

- Хедер с `pill-live` `LIVE LOBBY` + `pill-mono` с кодом.
- Two-column layout (mobile single-column):
  - **Левая**: eyebrow `ONLINE LOBBY · WAITING ROOM` → `<h1>` название
    игры → подпись `Хост: Ваня · 5 игроков, 2 зрителя`. Блок `Команды
    {N}/6` с кнопкой `Перемешать`. Grid `team-card`'ов (на mobile — 1кол,
    на desktop — 2кол). В каждой: title (`team-color`), `pill-mono` с
    счётчиком `Users N/6`, список `.slot`'ов (active для хоста, online
    точка). Внизу `.slot` с dashed `+ Слот свободен` (клик = занять
    место). После списка команд — карточка `+ Создать команду`. Ниже —
    блок `Зрители (N)` со списком `pill`'ов с маленькими аватарами.
  - **Правая (host panel)**: карточка с **`КОДОМ КОМНАТЫ`** — `eyebrow` +
    `code-chunk lg` (6 ячеек 52×64), потом две `btn-secondary btn-sm`
    `[Копировать код]` / `[Копировать ссылку]`, затем QR-блок (поверх
    `bg-2`) + ссылка `alias.online/p/{code}`. Карточка с настройками
    («Время раунда · 60 сек», «До победы 50 очков», «Категорий 4 / 287
    слов») + `[Изменить настройки]`. Большая `[Начать игру]`. Внизу —
    pulse-индикатор «Ждём ещё одного игрока».

### 5.4. Войти по коду — `screens-online.jsx::JoinScreen`

- Mobile-first. Eyebrow `JOIN A GAME` → h-display «Введите код /
  комнаты». Под ним 6 ячеек `code-chunk lg`, заполняемых поочерёдно
  (текущая ячейка с accent-border, пустые fg-3). Под ячейками — моно
  подсказка `ИЛИ ОТСКАНИРУЙТЕ QR`. Поле ника (`.input`, prefill). Primary
  `[Войти в комнату]`, ghost `[← На главную]`.

### 5.5. Передача устройства — `screens-online.jsx::PassDeviceScreen`

- (Локальный режим, перед каждым раундом.) eyebrow `РАУНД 3 · КОМАНДА
  «ЛИСЫ»` → h-display `Передайте / устройство`. Большая mint-gradient
  card: круглый avatar 64px, ниже «Ваня объясняет» (28/800), подпись
  «Угадывают остальные «Лисы»». Под карточкой — pills со счётом обеих
  команд. Primary `[Старт раунда]`.

### 5.6. Игра — `screens-game.jsx::GameScreen`

Параметры: `mobile`, `online`, `role` ∈ `{ explainer, guesser, spectator, host }`.

- Минимальный хедер (absolute top): pill команды слева, eyebrow `РАУНД N`
  по центру, справа — `pill-mono` accent (got) + `pill-mono` red (skip)
  + icon-btn pause.
  - В онлайне дополнительно — `pill-live` LIVE.
- Центр (`.word-stage`):
  - **explainer**: `BigTimer` + `WordCard` с самим словом + строка
    подсказок-кейкапов (`Space — угадал`, `→ — пропуск`).
  - **guesser** и **spectator**: одинаковый `BigTimer` + одинаковый
    `SpectatorCard`. Единственное отличие — eyebrow на карточке
    («ВЫ УГАДЫВАЕТЕ» vs «ВЫ СМОТРИТЕ»). Никаких функциональных различий.
- ActionBar показываем только для `explainer`/`host`.

`SpectatorCard`:
- Card 280-420px, eyebrow `ВЫ УГАДЫВАЕТЕ` или `ВЫ СМОТРИТЕ` (выезжает
  поверх верхней границы) — единственное, что зависит от роли.
- Avatar объясняющего 56px (team-color).
- «Ваня объясняет» (18/700) + подпись «команда «Лисы»».
- Pulse-точка accent + «говорит...».
- **Реакции 🔥🤔😂👏 удалены из v2 (см. PROMPT.md §2.7).** Карточка
  идентична для guesser и spectator.

### 5.7. Round summary — `screens-game.jsx::RoundSummaryScreen`

- Eyebrow `ИТОГИ РАУНДА` → h-title название команды → подпись «Нажмите
  на слово, чтобы изменить статус».
- Список `.word-row.got/.skip` (с иконкой check/x слева и моно `+1`/`0`
  справа).
- Под списком — `.card` с разбивкой: «Угадано +N / Пропущено N (штраф
  −N) / Итого за раунд +K» (последняя строка accent, 16/700).
- Primary `[Подтвердить и передать ход]`.

### 5.8. Победа — `screens-game.jsx::VictoryScreen`

- Иконка трофея 84×84 в warn-боксе.
- h-display `Победа!` (44-60px).
- pill-success c командой и счётом.
- `<h2>Финальный счёт</h2>` + список карточек с местами (1 — warn-кружок
  с `accent-fg`, остальные — bg-3/fg-2), цветной квадратик команды,
  название, моно score.
- Primary `[Реванш]` + secondary `[На главную]`.

### 5.9. Pause overlay — `screens-game.jsx::PauseScreen`

- Фуллскрин blur (`backdropFilter: blur(6px)`) + затемнение.
- Modal-card в центре, max-width 360. Заголовок `Пауза` (22/800), x
  `icon-btn` справа. Текст-объяснение fg-2. Primary `[Продолжить]` +
  danger `[Завершить раунд]`. Под пунктиром — два `kbd` со статистикой
  (`5/8 угадано`, `00:28 осталось`).

### 5.10. Bold-варианты — `screens-bold.jsx`

«Альтернативное направление»: огромная типографика (120px ALIAS),
floating word-card-стэк, чёрный outline-текст («В РЕАЛЬНОМ»), круговой
SVG-таймер 540×540 с stroke-dasharray, edge-to-edge action-bar с
кнопочными подсказками-кейкапами. **В v2 за основу берём «обычные»
экраны (`screens-home/setup/online/game`), а из bold вытаскиваем по
вкусу: круговой таймер опционально, hero hero-стиль с word-card-stack
для главной — опционально.**

---

## 6. Адаптивность

- В моках есть `mobile = true/false`. Mobile-версия = `phone` 375×720.
  Desktop = `desk` 1280×800.
- Основные различия:
  - mobile: одна колонка, header padding 12×16, paddings секций по 16px.
  - mobile: `Stepper` без подписей текста, только цифры.
  - mobile: все большие grids (категории, команды, mode-toggle) → 1 кол.
  - mobile: CTA-кнопки растягиваются на всю ширину, ghost «Назад» уходит
    под primary (column-reverse).
- В реализации тащим breakpoint от Tailwind: `md:` (≥768px) — переход на
  desktop layout.

---

## 7. Спец-эффекты и микро-анимации

- `.pulse` — `@keyframes ping`, 1.6s бесконечно. Для всех LIVE-индикаторов.
- Кнопки: `transition: transform .08s, background .15s, border-color .15s`,
  `:active { transform: translateY(1px) }`.
- Прогресс-бар таймера: `transition: width .3s ease`.
- Toggle: `left .15s, background .15s`.
- ModeCard: при выборе — fade-in radial accent glow.
- Card hover (history rows): `border-color → primary`, фон → `mix(primary 5%, bg-1)`.

---

## 8. Что нужно добавить, чего нет в дизайне

Дизайн покрывает основные экраны, но в v2 потребуется ещё:

1. **PRE_ROUND countdown** (3-2-1) — большая моно цифра в центре, fade
   между кадрами. Можно собрать из `BigTimer`-стилей.
2. **BETWEEN_ROUNDS «Следующий: команда X, объясняет Y»** — экран-
   переход (4 сек). Берём стиль `PassDeviceScreen`, но без кнопки
   `Старт`.
3. **Reconnect overlay** — `Pause`-стиль modal с indicator «Соединение
   потеряно… попытка N/3».
4. **Toast-уведомления** — небольшая card с pop-shadow, 2-4 сек жизни,
   для «Игрок Маша вышел / зашёл», «Слово было пропущено», «Хост закрыл
   комнату». В дизайне их нет, но без них онлайн будет «глухим».
5. **Public rooms** (если делаем) — strip в нижней части главной из
   `BoldHomeScreen`: 4 карточки с названием комнаты, кодом и числом
   игроков.

---

## 9. Подключение к коду

### 9.1. Tailwind + tokens

- В `apps/web/tailwind.config.ts` объявить `theme.extend.colors` через
  CSS-переменные:
  ```ts
  colors: {
    bg: 'var(--bg)', 'bg-1': 'var(--bg-1)', /* ... */
    fg: 'var(--fg)', 'fg-2': 'var(--fg-2)', /* ... */
    accent: 'var(--accent)', 'accent-soft': 'var(--accent-soft)',
    'team-1': 'var(--team-1)', /* до team-6 */
    danger: 'var(--danger)', warn: 'var(--warn)', success: 'var(--success)',
  }
  ```
- В `globals.css` импортировать `tokens.css` (где `:root { --bg: ...; ... }`).
- Радиусы и шрифты — тоже через `theme.extend.borderRadius` и
  `theme.extend.fontFamily`.

### 9.2. Класс-помощники

Дизайн использует много класс-имён (`.card`, `.btn`, `.team-card`, ...).
Можно либо:
- (рекомендуется) превратить их в React-компоненты (`<Card>`, `<Button>`,
  `<TeamCard>`) и использовать tailwind-классы внутри;
- либо скопировать `styles.css` в `globals.css` и прямо использовать
  классы. Минус — рассыпается типизация и дизайн-система.

### 9.3. Шрифты

В `apps/web/src/app/layout.tsx`:
```ts
import { Manrope, JetBrains_Mono } from 'next/font/google'

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
```

И в `<html>` → `${manrope.variable} ${mono.variable}`.

### 9.4. Тёмная тема

- На `<html>` ставим `data-theme="dark"` (по умолчанию) или `light`.
- Переключатель — иконка sun/moon в хедере, сохраняет выбор в
  `localStorage.theme`, инициализируется в inline-script (чтобы не было
  flash на загрузке).

---

## 10. Картинки и ассеты

В дизайне нет растровых изображений, иконок-PNG и логотипов — всё SVG
inline и CSS. Из `alias-game/public/sounds/timer-end.mp3` — оставляем
звук конца раунда (используется в локальной игре).

---

## 11. Резюме

- **Дизайн-токены** → один CSS-файл, подключенный глобально.
- **Базовые компоненты** (Button, Card, Pill, Toggle, Chip, Input,
  Modal, Avatar, Stepper, CodeChunk, BigTimer, ActionBar) — в
  `components/ui/`.
- **Экраны** собираются из этих компонентов + специфичных блоков
  (`ModeCard`, `TeamCard`, `WordCard`, `SpectatorCard`,
  `LobbyHostPanel`, `RoundSummary`, `VictoryHero`, `PauseModal`).
- Mobile = single-column + растянутые CTA. Desktop = две колонки в
  лобби, асимметричная сетка на главной.
- Цвета команд берём через `var(--team-N)` 1..6.
- Не забываем про PRE_ROUND/BETWEEN_ROUNDS/Reconnect/Toast — они в
  дизайне явно не показаны, но нужны для онлайн-игры.
