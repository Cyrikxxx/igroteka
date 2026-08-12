// GET /api/stats — агрегаты по играм текущего устройства (cookie `aid`).
// Используется плитками на странице истории.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";

const EMPTY = { games: 0, guessedWords: 0, successRate: 0, mafiaGames: 0, mafiaWins: 0 };

export async function GET() {
  try {
    const userId = await requireUserId();

    const [games, guessedWords, totalAnswered, mafiaGames, mafiaWins] =
      await Promise.all([
        prisma.game.count({ where: { ownerKey: userId } }),
        prisma.roundWord.count({
          where: { guessed: true, round: { game: { ownerKey: userId } } },
        }),
        prisma.roundWord.count({
          where: { round: { game: { ownerKey: userId } } },
        }),
        prisma.mafiaGame.count({
          where: { status: "FINISHED", players: { some: { userId } } },
        }),
        // «Мои победы за мафию»: партии, где я играл за мафию или дона
        // и победила мафия. Роль хранится строкой в MafiaPlayerRecord.
        prisma.mafiaGame.count({
          where: {
            status: "FINISHED",
            winner: "MAFIA",
            players: { some: { userId, role: { in: ["mafia", "don"] } } },
          },
        }),
      ]);

    const successRate = totalAnswered > 0 ? guessedWords / totalAnswered : 0;
    return NextResponse.json({
      games,
      guessedWords,
      successRate,
      mafiaGames,
      mafiaWins,
    });
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json(EMPTY);
    }
    console.error("[GET /api/stats]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
