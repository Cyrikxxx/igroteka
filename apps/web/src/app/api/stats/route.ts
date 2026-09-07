// GET /api/stats — агрегаты по играм текущего устройства (cookie `aid`).
// Используется плитками на странице истории.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";
import { visibleGamesWhere, visibleMafiaGamesWhere } from "@/lib/history-access";

const EMPTY = { games: 0, guessedWords: 0, successRate: 0, mafiaGames: 0, mafiaWins: 0 };

export async function GET() {
  try {
    const userId = await requireUserId();

    // Тот же отбор, что и у списка партий: иначе плитка «Сыграно партий»
    // спорила бы с длиной списка прямо на одном экране. Слова считаем все,
    // сколько их было в партии, а не только угаданные тобой лично: связать
    // раунд с человеком нечем — в Round лежит имя строкой, а не ссылка.
    const visible = visibleGamesWhere(userId);
    const visibleMafia = visibleMafiaGamesWhere(userId);
    const [games, guessedWords, totalAnswered, mafiaGames, mafiaWins] =
      await Promise.all([
        prisma.game.count({ where: visible }),
        prisma.roundWord.count({
          where: { guessed: true, round: { game: visible } },
        }),
        prisma.roundWord.count({
          where: { round: { game: visible } },
        }),
        prisma.mafiaGame.count({ where: visibleMafia }),
        // «Мои победы за мафию»: партии, где я играл за мафию или дона
        // и победила мафия. Роль хранится строкой в MafiaPlayerRecord.
        prisma.mafiaGame.count({
          where: {
            ...visibleMafia,
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
