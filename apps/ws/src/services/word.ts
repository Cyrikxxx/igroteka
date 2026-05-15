// Выбор пакета слов для раунда и работа с очередью в Redis.
// См. PROMPT.md §2.6.3.

import { WORDS_BATCH_SIZE } from "@alias/shared/constants";
import { roomWordsKey } from "@alias/shared/redis-keys";
import { redis } from "../redis";
import { prisma } from "../prisma";

export interface WordItem {
  id: number;
  text: string;
}

/** Достаёт N неиспользованных слов для игры, ORDER BY random(). */
export async function fetchWordsBatch(
  gameId: string,
  n: number = WORDS_BATCH_SIZE,
): Promise<WordItem[]> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameCategories: { select: { categoryId: true } } },
  });
  if (!game) return [];

  const categoryIds = game.gameCategories.map((gc) => gc.categoryId);
  if (categoryIds.length === 0) return [];

  // NOT EXISTS — быстрее чем notIn для больших словарей.
  const rows = await prisma.word.findMany({
    where: {
      categories: { some: { categoryId: { in: categoryIds } } },
      NOT: { roundWords: { some: { round: { gameId } } } },
    },
    select: { id: true, text: true },
  });

  // Shuffle (Fisher-Yates) и режем до n.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows.slice(0, n);
}

/** Кладёт слова в Redis-очередь раунда (FIFO через RPUSH). */
export async function pushWordsToQueue(
  code: string,
  words: WordItem[],
): Promise<void> {
  if (words.length === 0) return;
  const key = roomWordsKey(code);
  await redis.del(key);
  const args = words.map((w) => JSON.stringify(w));
  await redis.rpush(key, ...args);
}

/** Достаёт следующее слово из очереди (LPOP), null если пусто. */
export async function popNextWord(code: string): Promise<WordItem | null> {
  const raw = await redis.lpop(roomWordsKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WordItem;
  } catch {
    return null;
  }
}

/** Очищает очередь (по окончании раунда). */
export async function clearWordsQueue(code: string): Promise<void> {
  await redis.del(roomWordsKey(code));
}

export async function remainingWordsCount(code: string): Promise<number> {
  return redis.llen(roomWordsKey(code));
}
