// Витрина словаря на лендинге Алиаса против самого словаря.
//
// Лендинг статический и в базу не ходит, поэтому числа подборок написаны на
// странице руками. Пересев словаря молча превратил бы их во враньё — ровно та
// болезнь, из-за которой на лендинге годами висели выдуманные наборы. Здесь
// дубль сверяется с prisma/data/alias-catalog.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  WORD_PACKS,
  WORD_LEVELS,
  LEVELS_TOTAL,
  WORDS_TOTAL,
} from "../src/constants/word-packs";

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

  it("уровни сложности перечислены все и с настоящими числами", () => {
    const levels = catalog.categories.filter((c) => c.kind === "LEVEL");
    expect(WORD_LEVELS.map((l) => l.slug)).toEqual(levels.map((l) => l.slug));

    for (const level of WORD_LEVELS) {
      const real = levels.find((l) => l.slug === level.slug)!;
      // В каталоге название с приставкой «уровень», на карточке — без неё.
      expect(real.name).toContain(level.name);
      expect(level.words).toBe(real.words.length);
    }

    const unique = new Set(levels.flatMap((l) => l.words));
    expect(LEVELS_TOTAL).toBe(unique.size);
  });

  it("общий счёт слов не разошёлся со словарём", () => {
    const all = new Set(catalog.categories.flatMap((c) => c.words));
    expect(WORDS_TOTAL).toBe(all.size);
  });
});
