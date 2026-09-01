// GET /api/games/[id]/words — пакет неиспользованных слов (BATCH=50).

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";
import { WORDS_BATCH_SIZE } from "@/constants/game";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        ownerKey: true,
        gameCategories: { select: { categoryId: true } },
      },
    });
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (game.ownerKey !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const categoryIds = game.gameCategories.map((gc) => gc.categoryId);
    if (categoryIds.length === 0) return NextResponse.json([]);

    // Слова текущих категорий, ещё не сыгранные в этой партии. Отбор целиком
    // в SQL: раньше запрос тянул все подходящие слова в память и тасовал их
    // в JS, а в базе теперь 8134 слова — при выборе всего каталога это была
    // бы вычитка восьми тысяч строк на каждый пакет из пятидесяти.
    //
    // EXISTS, а не IN по связям: слово возвращается один раз независимо от
    // того, сколько выбранных категорий его содержат. Поэтому пересечение
    // уровней сложности с темами не даёт повторов.
    const batch = await prisma.$queryRaw<{ id: number; text: string }[]>`
      SELECT w.id, w.text
      FROM "Word" w
      WHERE EXISTS (
        SELECT 1 FROM "WordCategory" wc
        WHERE wc."wordId" = w.id AND wc."categoryId" = ANY(${categoryIds})
      )
      AND NOT EXISTS (
        SELECT 1 FROM "RoundWord" rw
        JOIN "Round" r ON r.id = rw."roundId"
        WHERE rw."wordId" = w.id AND r."gameId" = ${id}
      )
      ORDER BY random()
      LIMIT ${WORDS_BATCH_SIZE}
    `;
    return NextResponse.json(batch);
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[GET /api/games/[id]/words]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
