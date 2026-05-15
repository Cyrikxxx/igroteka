// GET /api/stats — агрегаты по играм текущего устройства (cookie `aid`).
// Используется на главной странице для stats-strip.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";

export async function GET() {
  try {
    const userId = await requireUserId();

    const [games, guessedWords, totalAnswered] = await Promise.all([
      prisma.game.count({ where: { ownerKey: userId } }),
      prisma.roundWord.count({
        where: { guessed: true, round: { game: { ownerKey: userId } } },
      }),
      prisma.roundWord.count({
        where: { round: { game: { ownerKey: userId } } },
      }),
    ]);

    const successRate = totalAnswered > 0 ? guessedWords / totalAnswered : 0;
    return NextResponse.json({ games, guessedWords, successRate });
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ games: 0, guessedWords: 0, successRate: 0 });
    }
    console.error("[GET /api/stats]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
