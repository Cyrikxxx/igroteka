// Витрина словаря на лендинге Алиаса против самого словаря.
//
// Лендинг статический и в базу не ходит, поэтому числа подборок написаны на
// странице руками. Пересев словаря молча превратил бы их во враньё — ровно та
// болезнь, из-за которой на лендинге годами висели выдуманные наборы. Здесь
// дубль сверяется с prisma/data/alias-catalog.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { WORD_PACKS, WORD_LEVELS, WORDS_TOTAL } from "../src/constants/word-packs";

interface CatalogCategory {
  slug: string;
  name: string;
  kind: "THEME" | "LEVEL";
  collectionSlug: string | null;
  words: string[];
}

interface Catalog {
  collections: { slug: string; name: string; description: string }[];
  categories: CatalogCategory[];
}

const catalog = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../prisma/data/alias-catalog.json", import.meta.url)),
    "utf8",
  ),
) as Catalog;

/** Темы одной подборки. Уровни сложности в подборки не входят. */
function themesOf(slug: string) {
  return catalog.categories.filter(
    (c) => c.kind === "THEME" && c.collectionSlug === slug,
  );
}

describe("витрина наборов слов", () => {
  it("перечислены все подборки каталога и ничего лишнего", () => {
    expect(WORD_PACKS.map((p) => p.slug)).toEqual(
      catalog.collections.map((c) => c.slug),
    );
  });

  it.each(WORD_PACKS.map((p) => [p.slug, p] as const))(
    "%s — название, описание, темы и слова совпадают с каталогом",
    (slug, pack) => {
      const collection = catalog.collections.find((c) => c.slug === slug);
      expect(collection, `в каталоге нет подборки ${slug}`).toBeDefined();

      // Эмодзи в каталоге приклеено к названию, а на карточке своя иконка.
      expect(collection!.name).toContain(pack.name);
      expect(pack.desc).toBe(collection!.description);

      const themes = themesOf(slug);
      expect(pack.themes).toBe(themes.length);

      // Слова считаем уникальными: одно слово встречается в нескольких темах.
      const unique = new Set(themes.flatMap((t) => t.words));
      expect(pack.words).toBe(unique.size);
    },
  );

  it("уровни сложности и общий счёт слов не разошлись", () => {
    const levels = catalog.categories.filter((c) => c.kind === "LEVEL");
    expect(WORD_LEVELS).toHaveLength(levels.length);
    for (const label of WORD_LEVELS) {
      expect(levels.some((l) => l.name.startsWith(label))).toBe(true);
    }

    const all = new Set(catalog.categories.flatMap((c) => c.words));
    expect(WORDS_TOTAL).toBe(all.size);
  });
});
