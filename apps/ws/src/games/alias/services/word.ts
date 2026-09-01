// Выбор пакета слов для раунда и работа с очередью в Redis.

import { WORDS_BATCH_SIZE } from "@alias/shared/constants";
import { roomWordsKey } from "@alias/shared/redis-keys";
import { redis } from "../../../redis";
import { prisma } from "../../../prisma";

export interface WordItem {
  id: number;
  text: string;
}

/**
 * Достаёт N неиспользованных слов для игры.
 *
 * Отбор целиком в SQL. Раньше запрос тянул ВСЕ подходящие слова в память и
 * тасовал их в JS: на тестовом словаре в 629 слов это было незаметно, но
 * теперь в базе 8134 слова, и при выборе всего каталога каждый пакет из
 * пятидесяти означал бы вычитку восьми тысяч строк — и так каждый раунд.
 *
 * EXISTS вместо IN по связям: слово возвращается один раз независимо от
 * того, сколько выбранных категорий его содержат. Именно поэтому пересечение
 * уровней сложности с темами не даёт повторов.
 */
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

  return prisma.$queryRaw<WordItem[]>`
    SELECT w.id, w.text
    FROM "Word" w
    WHERE EXISTS (
      SELECT 1 FROM "WordCategory" wc
      WHERE wc."wordId" = w.id AND wc."categoryId" = ANY(${categoryIds})
    )
    AND NOT EXISTS (
      SELECT 1 FROM "RoundWord" rw
      JOIN "Round" r ON r.id = rw."roundId"
      WHERE rw."wordId" = w.id AND r."gameId" = ${gameId}
    )
    ORDER BY random()
    LIMIT ${n}
  `;
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
