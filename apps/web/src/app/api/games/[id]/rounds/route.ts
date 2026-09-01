// POST /api/games/[id]/rounds — финализировать раунд локальной игры:
// транзакцией пишет Round + RoundWord[], обновляет счёт команды и
// переводит ход. Тот же алгоритм у онлайна — apps/ws/src/services/game.ts.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";
import { nextTrioTurn, trioRoles, scoredTeamIndexes } from "@alias/shared/trio";

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

    const trio = game.format === "TRIO";
    const byOrder = (idx: number) => game.teams.find((t) => t.order === idx) ?? null;

    const guessedCount = words.filter((w) => w.guessed).length;
    const skippedCount = words.filter((w) => !w.guessed).length;
    const scoreEarned = guessedCount - (game.penaltySkip ? skippedCount : 0);

    // Кому засчитать раунд. Втроём это оба игрока пары: и тот, кто объяснял,
    // и тот, кто угадывал. Отдыхающий не получает ничего.
    const scored = scoredTeamIndexes(game.format, game.trioTurn, game.currentTeamIndex)
      .map(byOrder)
      .filter((t) => t !== null)
      .map((t) => ({ id: t.id, score: Math.max(0, t.score + scoreEarned) }));
    const newTeamScore = scored.find((s) => s.id === teamId)?.score ?? team.score;
    const partnerTeamId = trio
      ? (byOrder(trioRoles(game.trioTurn).guesser)?.id ?? null)
      : null;

    // Ход. Втроём круг из шести ходов: сначала три пары, потом те же три с
    // обменом ролями, — поэтому крутится trioTurn, а currentTeamIndex просто
    // следует за тем, кто объясняет.
    const numTeams = game.teams.length;
    const nextTrio = trio ? nextTrioTurn(game.trioTurn) : game.trioTurn;
    const nextTeamIndex = trio
      ? trioRoles(nextTrio).explainer
      : (game.currentTeamIndex + 1) % numTeams;
    // Конец круга — момент, когда у всех было поровну ходов.
    const circleDone = trio ? nextTrio === 0 : nextTeamIndex === 0;
    const nextRoundNumber = circleDone
      ? game.currentRoundNumber + 1
      : game.currentRoundNumber;

    // Проверка победы — только в конце круга (как в v1).
    let gameFinished = false;
    let winnerId: number | undefined;
    if (game.winScore > 0 && circleDone) {
      const futureScores = game.teams.map((t) => {
        const hit = scored.find((s) => s.id === t.id);
        return hit ? { ...t, score: hit.score } : t;
      });
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
          partnerTeamId,
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

      // Втроём тут две команды: очки идут и объяснявшему, и угадывавшему.
      for (const s of scored) {
        const t = game.teams.find((x) => x.id === s.id)!;
        await tx.team.update({
          where: { id: s.id },
          data: {
            score: s.score,
            currentPlayerIndex: (t.currentPlayerIndex + 1) % t.players.length,
          },
        });
      }

      await tx.game.update({
        where: { id },
        data: {
          currentTeamIndex: gameFinished ? game.currentTeamIndex : nextTeamIndex,
          currentRoundNumber: gameFinished
            ? game.currentRoundNumber
            : nextRoundNumber,
          trioTurn: gameFinished ? game.trioTurn : nextTrio,
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
      scores: scored,
      nextTeamIndex,
      nextTrioTurn: nextTrio,
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
