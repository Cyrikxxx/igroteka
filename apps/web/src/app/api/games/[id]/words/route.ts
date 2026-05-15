// GET /api/games/[id]/words — пакет неиспользованных слов (BATCH=50).
// См. PROMPT.md §2.3.2 и алгоритм в §2.6.3.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";
import { shuffleArray } from "@/lib/utils";
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

    // Слова текущих категорий, ещё не использованные ни в одном раунде этой игры.
    const words = await prisma.word.findMany({
      where: {
        categories: { some: { categoryId: { in: categoryIds } } },
        NOT: { roundWords: { some: { round: { gameId: id } } } },
      },
      select: { id: true, text: true },
    });

    const batch = shuffleArray(words).slice(0, WORDS_BATCH_SIZE);
    return NextResponse.json(batch);
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[GET /api/games/[id]/words]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
