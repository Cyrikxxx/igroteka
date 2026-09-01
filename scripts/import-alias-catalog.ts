// Импорт каталога тем из markdown в JSON, который читает seed.
//
// Зачем два шага, а не парсинг прямо в seed: папка project-context исключена
// из образа (.dockerignore), поэтому в проде markdown недоступен. Скрипт
// запускается руками, когда правится каталог:
//
//   npx tsx scripts/import-alias-catalog.ts
//
// Он же сторож качества данных — падает, если каталог нарушает правила
// (тема без подборки, дубль slug, слишком короткая тема).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "project-context/alias-categories");
const OUT = resolve(ROOT, "prisma/data/alias-catalog.json");

/** Минимум слов в теме — из методики каталога (партия около 150 слов). */
const MIN_WORDS = 150;
/**
 * Жёсткий потолок длины. Это не про вёрстку, а про сторожа: если парсер
 * зацепит не тот кусок markdown, туда прилетит целое предложение.
 * Настоящие длинные слова каталога — названия фильмов и игр («Полицейский
 * с Рублёвки») — укладываются в 22 символа.
 */
const MAX_WORD_LEN = 24;
/** Порог из методики каталога: длиннее — риск сломать карточку на телефоне. */
const WARN_WORD_LEN = 14;

// ─────────── Раскладка тем по подборкам ───────────
// Тема входит ровно в одну подборку — это делает список строгим разбиением:
// тема нигде не дублируется, состояние карточки однозначно.

interface CollectionDef {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  categories: string[];
}

const COLLECTIONS: CollectionDef[] = [
  {
    slug: "classic",
    name: "Классика",
    emoji: "🏛",
    description: "Проверенное временем. Работает с любой компанией",
    categories: ["animals", "food", "jobs", "home", "transport"],
  },
  {
    slug: "world",
    name: "Мир вокруг",
    emoji: "🌍",
    description: "Природа, спорт, дорога и дача",
    categories: ["nature", "sport", "travel", "dacha"],
  },
  {
    slug: "people",
    name: "Про людей",
    emoji: "💘",
    description: "Чувства, характер, отношения и внешность",
    categories: ["emotions", "character", "love", "body"],
  },
  {
    slug: "daily",
    name: "Будни",
    emoji: "💼",
    description: "Школа, работа, деньги, врачи и неловкие моменты",
    categories: ["school", "work", "money", "health", "awkward"],
  },
  {
    slug: "popculture",
    name: "Поп-культура",
    emoji: "🎮",
    description: "Кино, игры, музыка и мемы",
    categories: ["movies", "games", "music", "internet", "memes", "boardgames"],
  },
  {
    slug: "challenge",
    name: "Челлендж",
    emoji: "🧠",
    description: "Когда обычные слова стали слишком лёгкими",
    categories: ["abstract", "verbs", "senses", "science", "history"],
  },
  {
    slug: "holidays",
    name: "Праздники",
    emoji: "🎉",
    description: "Вечеринки, Новый год, Хэллоуин и лето",
    categories: ["party", "newyear", "halloween", "summer"],
  },
  {
    slug: "kids-mix",
    name: "Детям",
    emoji: "🧸",
    description: "Для самых маленьких и тех, кто вырос на мультиках",
    categories: ["kids", "cartoons"],
  },
];

/** Эмодзи карточек. В markdown их нет — назначаем здесь. */
const EMOJI: Record<string, string> = {
  "level-easy": "🟢",
  "level-normal": "🟡",
  "level-hard": "🔴",
  animals: "🐾",
  food: "🍕",
  jobs: "👷",
  home: "🏠",
  transport: "🚗",
  nature: "🌲",
  sport: "⚽",
  travel: "✈️",
  dacha: "🌻",
  emotions: "😊",
  character: "🎭",
  love: "💞",
  body: "👤",
  school: "🎒",
  work: "🖥",
  money: "💰",
  health: "🩺",
  awkward: "😬",
  movies: "🎬",
  games: "🕹",
  music: "🎵",
  internet: "📱",
  memes: "😂",
  boardgames: "🎲",
  abstract: "💭",
  verbs: "🏃",
  senses: "👂",
  science: "🔬",
  history: "🏺",
  party: "🥳",
  newyear: "🎄",
  halloween: "🎃",
  summer: "☀️",
  kids: "🍼",
  cartoons: "🦄",
};

/** Сезон темы — по нему карточка поднимается наверх в свой месяц. */
const SEASON: Record<string, string> = {
  newyear: "newyear",
  halloween: "halloween",
  summer: "summer",
};

// ─────────── Парсер markdown ───────────

interface ParsedCategory {
  name: string;
  slug: string;
  group: string;
  isPopular: boolean;
  words: string[];
}

/**
 * Тема в markdown выглядит так:
 *
 *   ### Животные
 *   (пустая строка)
 *   `animals` · группа: Классика · популярная
 *   ...
 *   **Домашние и фермерские**
 *   собака, кошка, лошадь, ...
 *
 * Блоки нужны только для чтения и правки — в игре тема отдаётся одним
 * общим перемешанным пулом, поэтому здесь они склеиваются.
 */
function parseCatalog(file: string): ParsedCategory[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const out: ParsedCategory[] = [];
  let cur: ParsedCategory | null = null;

  for (let i = 0; i < lines.length; i++) {
    // Любой заголовок уровнем выше темы закрывает текущую. Без этого
    // «Часть 5» с её списками через запятую дописывалась словами в
    // последнюю разобранную тему.
    if (/^#{1,2} /.test(lines[i])) cur = null;

    const head = /^### (.+)$/.exec(lines[i]);
    if (head && i + 2 < lines.length) {
      const meta =
        /^`([a-z0-9-]+)`\s*·\s*группа:\s*([^·]+?)\s*(?:·\s*(популярная|сезонная))?$/.exec(
          lines[i + 2].trim(),
        );
      if (meta) {
        cur = {
          name: head[1].trim(),
          slug: meta[1],
          group: meta[2].trim(),
          isPopular: meta[3] === "популярная",
          words: [],
        };
        out.push(cur);
        i += 2;
        continue;
      }
    }
    if (cur && /^\*\*[^*]+\*\*$/.test(lines[i]) && i + 1 < lines.length) {
      const words = lines[i + 1]
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
      if (words.length > 0) {
        cur.words.push(...words);
        i += 1;
      }
    }
  }
  return out;
}

// ─────────── Сборка и проверка ───────────

function main(): void {
  const themes = parseCatalog(resolve(SRC, "alias-catalog.md"));
  const levels = parseCatalog(resolve(SRC, "alias-levels.md"));
  const problems: string[] = [];

  const warnings: string[] = [];
  const bySlug = new Map<string, ParsedCategory>();
  for (const c of [...themes, ...levels]) {
    if (bySlug.has(c.slug)) problems.push(`slug «${c.slug}» встречается дважды`);
    bySlug.set(c.slug, c);

    if (c.words.length < MIN_WORDS) {
      problems.push(`«${c.name}»: ${c.words.length} слов, минимум ${MIN_WORDS}`);
    }
    if (!EMOJI[c.slug]) {
      problems.push(`«${c.name}» (${c.slug}): не назначен эмодзи`);
    }
    const dup = [...new Set(c.words.filter((w, i) => c.words.indexOf(w) !== i))];
    if (dup.length > 0) {
      problems.push(`«${c.name}»: слово повторяется внутри темы — ${dup.slice(0, 5).join(", ")}`);
    }
    const long = c.words.filter((w) => w.length > MAX_WORD_LEN);
    if (long.length > 0) {
      problems.push(`«${c.name}»: длиннее ${MAX_WORD_LEN} символов — ${long.slice(0, 3).join(", ")}`);
    }
    const wide = c.words.filter((w) => w.length > WARN_WORD_LEN && w.length <= MAX_WORD_LEN);
    if (wide.length > 0) {
      warnings.push(`«${c.name}»: ${wide.length} слов длиннее ${WARN_WORD_LEN} символов`);
    }
  }

  // Каждая тема ровно в одной подборке, каждая подборка — на живые темы.
  const placed = new Map<string, string>();
  for (const col of COLLECTIONS) {
    for (const slug of col.categories) {
      if (!bySlug.has(slug)) {
        problems.push(`подборка «${col.name}» ссылается на несуществующую тему «${slug}»`);
        continue;
      }
      const already = placed.get(slug);
      if (already) problems.push(`тема «${slug}» и в «${already}», и в «${col.name}»`);
      placed.set(slug, col.name);
    }
  }
  for (const t of themes) {
    if (!placed.has(t.slug)) {
      problems.push(`тема «${t.name}» (${t.slug}) не входит ни в одну подборку`);
    }
  }

  if (problems.length > 0) {
    console.error("Каталог не прошёл проверку:\n");
    for (const p of problems) console.error("  x " + p);
    process.exit(1);
  }

  const catalog = {
    collections: COLLECTIONS.map((c, order) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      description: c.description,
      order,
    })),
    categories: [
      ...levels.map((c, order) => ({
        slug: c.slug,
        name: c.name,
        emoji: EMOJI[c.slug],
        kind: "LEVEL",
        collectionSlug: null,
        season: null,
        isPopular: c.isPopular,
        order,
        words: c.words,
      })),
      ...COLLECTIONS.flatMap((col) =>
        col.categories.map((slug, order) => {
          const c = bySlug.get(slug)!;
          return {
            slug: c.slug,
            name: c.name,
            emoji: EMOJI[c.slug],
            kind: "THEME",
            collectionSlug: col.slug,
            season: SEASON[c.slug] ?? null,
            isPopular: c.isPopular,
            order,
            words: c.words,
          };
        }),
      ),
    ],
  };

  writeFileSync(OUT, JSON.stringify(catalog, null, 1) + "\n", "utf8");

  const links = catalog.categories.reduce((n, c) => n + c.words.length, 0);
  const unique = new Set(catalog.categories.flatMap((c) => c.words)).size;
  console.log(`Подборок:   ${catalog.collections.length}`);
  console.log(`Тем:        ${themes.length}`);
  console.log(`Уровней:    ${levels.length}`);
  console.log(`Связей:     ${links}`);
  console.log(`Уникальных: ${unique} слов`);
  if (warnings.length > 0) {
    console.log(`\nНа заметку (длинные слова могут поджимать карточку):`);
    for (const w of warnings) console.log("  ! " + w);
  }
  console.log("");
  for (const col of COLLECTIONS) {
    const n = col.categories.reduce((s, x) => s + bySlug.get(x)!.words.length, 0);
    const tail = `${String(col.categories.length).padStart(2)} тем  ${String(n).padStart(5)} слов`;
    console.log(`  ${col.emoji} ${col.name.padEnd(14)} ${tail}`);
  }
  console.log(`\n-> ${OUT}`);
}

main();
