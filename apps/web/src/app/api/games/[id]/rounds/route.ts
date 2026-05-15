// POST /api/games/[id]/rounds — финализировать раунд локальной игры.
// Алгоритм идентичен старому проекту (см. CURRENT_CODE.md §5) + новые поля
// (Round.startedAt/endedAt, RoundWord.order, Game.finishedAt при FINISHED).

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";

type Ctx = { params: Promise<{ id: string }> };

interface RoundWordInput {
  wordId: number;
  guessed: boolean;
  order: number;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await request.json();
    const { teamId, playerName, words } = body as {
      teamId?: number;
      playerName?: string;
      words?: RoundWordInput[];
    };

    if (
      typeof teamId !== "number" ||
      typeof playerName !== "string" ||
      !Array.isArray(words)
    ) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        teams: {
          include: { players: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (game.ownerKey !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (game.status === "FINISHED") {
      return NextResponse.json({ error: "Game already finished" }, { status: 409 });
    }

    const team = game.teams.find((t) => t.id === teamId);
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const guessedCount = words.filter((w) => w.guessed).length;
    const skippedCount = words.filter((w) => !w.guessed).length;
    const scoreEarned = guessedCount - (game.penaltySkip ? skippedCount : 0);
    const newTeamScore = Math.max(0, team.score + scoreEarned);

    const numTeams = game.teams.length;
    const nextTeamIndex = (game.currentTeamIndex + 1) % numTeams;
    const nextRoundNumber =
      nextTeamIndex === 0 ? game.currentRoundNumber + 1 : game.currentRoundNumber;

    // Проверка победы — только в конце цикла команд (как в v1).
    let gameFinished = false;
    let winnerId: number | undefined;
    if (game.winScore > 0 && nextTeamIndex === 0) {
      const futureScores = game.teams.map((t) =>
        t.id === teamId ? { ...t, score: newTeamScore } : t,
      );
      const qualified = futureScores.filter((t) => t.score >= game.winScore);
      if (qualified.length > 0) {
        const winner = qualified.reduce((best, t) => (t.score > best.score ? t : best));
        gameFinished = true;
        winnerId = winner.id;
      }
    }

    const newUsedWordIds = words.map((w) => w.wordId);

    const result = await prisma.$transaction(async (tx) => {
      const round = await tx.round.create({
        data: {
          gameId: id,
          teamId,
          roundNumber: game.currentRoundNumber,
          playerName,
          scoreEarned,
          endedAt: new Date(),
          words: {
            create: words.map((w) => ({
              wordId: w.wordId,
              guessed: w.guessed,
              order: w.order,
            })),
          },
        },
        select: { id: true, roundNumber: true, scoreEarned: true },
      });

      await tx.team.update({
        where: { id: teamId },
        data: {
          score: newTeamScore,
          currentPlayerIndex: (team.currentPlayerIndex + 1) % team.players.length,
        },
      });

      await tx.game.update({
        where: { id },
        data: {
          currentTeamIndex: gameFinished ? game.currentTeamIndex : nextTeamIndex,
          currentRoundNumber: gameFinished
            ? game.currentRoundNumber
            : nextRoundNumber,
          status: gameFinished ? "FINISHED" : "IN_PROGRESS",
          finishedAt: gameFinished ? new Date() : null,
          usedWordIds: { push: newUsedWordIds },
        },
      });

      return round;
    });

    return NextResponse.json({
      round: result,
      teamScore: newTeamScore,
      nextTeamIndex,
      nextRoundNumber,
      gameFinished,
      winnerId,
    });
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[POST /api/games/[id]/rounds]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
