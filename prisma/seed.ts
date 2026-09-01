// Seed: подборки, темы, уровни сложности и слова из prisma/data/alias-catalog.json.
// Файл готовит `npx tsx scripts/import-alias-catalog.ts` из markdown-каталога.
//
// Запуск: `npm run db:seed`.
//
// ВНИМАНИЕ: сид разрушающий — он стирает словарь и все партии. Каталог
// пересобирается целиком, а тема в новой раскладке может сменить id, из-за
// чего ссылки старых партий всё равно стали бы мусором.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CatalogCategory {
  slug: string;
  name: string;
  emoji: string;
  kind: string;
  collectionSlug: string | null;
  season: string | null;
  isPopular: boolean;
  order: number;
  words: string[];
}

interface Catalog {
  collections: {
    slug: string;
    name: string;
    emoji: string;
    description: string;
    order: number;
  }[];
  categories: CatalogCategory[];
}

/**
 * Постгрес не принимает больше 65 535 параметров в одном запросе, а слов
 * тут восемь тысяч. Заодно это спасает от гигантских транзакций.
 */
const CHUNK = 4000;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function wipe(): Promise<void> {
  // Порядок важен: сначала то, что ссылается, потом то, на что ссылаются.
  await prisma.roundWord.deleteMany();
  await prisma.round.deleteMany();
  await prisma.gameCategory.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.game.deleteMany();

  await prisma.mafiaPlayerRecord.deleteMany();
  await prisma.mafiaGame.deleteMany();

  await prisma.roomCategory.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.room.deleteMany();

  await prisma.wordCategory.deleteMany();
  await prisma.word.deleteMany();
  await prisma.category.deleteMany();
  await prisma.collection.deleteMany();
}

async function main(): Promise<void> {
  const file = resolve(__dirname, "data/alias-catalog.json");
  const catalog = JSON.parse(readFileSync(file, "utf8")) as Catalog;

  console.log("Стираю старый словарь и партии…");
  await wipe();

  await prisma.collection.createMany({ data: catalog.collections });
  const collectionId = new Map(
    (await prisma.collection.findMany({ select: { id: true, slug: true } })).map((c) => [
      c.slug,
      c.id,
    ]),
  );

  await prisma.category.createMany({
    data: catalog.categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      kind: c.kind,
      collectionId: c.collectionSlug ? collectionId.get(c.collectionSlug)! : null,
      order: c.order,
      isPopular: c.isPopular,
      season: c.season,
    })),
  });
  const categoryId = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [
      c.slug,
      c.id,
    ]),
  );

  // Слово живёт одной строкой на весь словарь (Word.text уникален), а с
  // темами связано через WordCategory. Поэтому «собака» из «Животных» и
  // «собака» из «Лёгкого уровня» — одна строка с двумя связями, и на выбор
  // слов в игре пересечение тем и уровней не влияет.
  const uniqueWords = [...new Set(catalog.categories.flatMap((c) => c.words))];
  for (const part of chunks(uniqueWords, CHUNK)) {
    await prisma.word.createMany({
      data: part.map((text) => ({ text })),
      skipDuplicates: true,
    });
  }
  const wordId = new Map(
    (await prisma.word.findMany({ select: { id: true, text: true } })).map((w) => [w.text, w.id]),
  );

  const links = catalog.categories.flatMap((c) =>
    c.words.map((text) => ({ wordId: wordId.get(text)!, categoryId: categoryId.get(c.slug)! })),
  );
  for (const part of chunks(links, CHUNK)) {
    await prisma.wordCategory.createMany({ data: part, skipDuplicates: true });
  }

  // ─── Сводка и сверка с данными каталога ───
  const [collections, categories, words, wordLinks] = await Promise.all([
    prisma.collection.count(),
    prisma.category.count(),
    prisma.word.count(),
    prisma.wordCategory.count(),
  ]);

  console.log(`\nПодборок:   ${collections}`);
  console.log(`Категорий:  ${categories} (из них уровней: ${catalog.categories.filter((c) => c.kind === "LEVEL").length})`);
  console.log(`Слов:       ${words}`);
  console.log(`Связей:     ${wordLinks}`);

  const expectedWords = uniqueWords.length;
  const expectedLinks = links.length;
  if (words !== expectedWords || wordLinks !== expectedLinks) {
    throw new Error(
      `Расхождение с каталогом: ожидалось ${expectedWords} слов и ${expectedLinks} связей`,
    );
  }

  for (const col of catalog.collections) {
    const inside = catalog.categories.filter((c) => c.collectionSlug === col.slug);
    const n = inside.reduce((s, c) => s + c.words.length, 0);
    console.log(`  ${col.emoji} ${col.name.padEnd(14)} ${String(inside.length).padStart(2)} тем  ${String(n).padStart(5)} слов`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
