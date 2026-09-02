// Postgres-мутации игрового цикла: создание Game/Team/Player при старте,
// фиксация раунда при review_confirm.

import { prisma } from "../../../prisma";
import type { GameFormat, RoomSnapshot } from "@alias/shared/domain";
import { nextTrioTurn, trioRoles, scoredTeamIndexes } from "@alias/shared/trio";
import type { RoundState } from "./roundState";
import { scoreRound, checkWinner } from "./score";
import { nextTurn, nextPlayerIndex } from "./turn";

/**
 * При переходе LOBBY → PRE_ROUND: создаём Game и копируем команды/игроков
 * из snapshot'а в Postgres. Только online-игроки попадают в Team.players;
 * offline во время старта автоматически отправляются в зрители (snapshot
 * меняется до вызова этой функции).
 */
export async function createGameFromSnapshot(
  snapshot: RoomSnapshot,
  roomId: string,
): Promise<{ gameId: string; teamIdMap: Record<number, number> }> {
  const trio = snapshot.format === "TRIO";
  const game = await prisma.game.create({
    data: {
      mode: "ONLINE",
      format: trio ? "TRIO" : "TEAMS",
      ownerKey: snapshot.hostId,
      roomId,
      roundTime: snapshot.settings.roundTime,
      winScore: snapshot.settings.winScore,
      penaltySkip: snapshot.settings.penaltySkip,
      currentTeamIndex: 0,
      currentRoundNumber: 1,
      gameCategories: {
        create: snapshot.settings.categoryIds.map((categoryId) => ({
          categoryId,
        })),
      },
      teams: {
        create: snapshot.teams.map((team, idx) => ({
          // Втроём команда — это один человек, и на табло должно стоять его
          // имя, а не «Место 2».
          name: trio ? (team.players[0]?.displayName ?? team.name) : team.name,
          color: team.color,
          order: idx,
          players: {
            create: team.players.map((p, pIdx) => ({
              name: p.displayName,
              order: pIdx,
              userId: p.userId,
            })),
          },
        })),
      },
    },
    include: {
      teams: { orderBy: { order: "asc" } },
    },
  });

  // Маппинг "snapshot teamId" → "Postgres Team.id".
  // snapshot.teams и game.teams сохраняют порядок (order asc), их можно
  // запинать парой.
  const teamIdMap: Record<number, number> = {};
  snapshot.teams.forEach((snapTeam, i) => {
    const dbTeam = game.teams[i];
    if (dbTeam) teamIdMap[snapTeam.id] = dbTeam.id;
  });

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "IN_GAME", startedAt: new Date() },
  });

  return { gameId: game.id, teamIdMap };
}

/**
 * При переходе ROUND_REVIEW → BETWEEN_ROUNDS: транзакция
 * Round + RoundWord[] + Team.score + Game.{currentTeamIndex,...}.
 * Алгоритм тот же, что у локальной игры в POST /api/games/[id]/rounds.
 */
export async function finalizeRound(args: {
  gameId: string;
  dbTeamId: number;
  snapshotTeamId: number;
  round: RoundState;
  teamScoreBefore: number;
  penaltySkip: boolean;
  winScore: number;
  /**
   * Команды из snapshot'а в порядке order — нужны и для проверки победы, и
   * чтобы втроём найти вторую команду пары по индексу.
   */
  teamsAfterUpdate: { snapshotId: number; dbId: number; scoreAfter: number }[];
  currentTeamIndex: number;
  currentRoundNumber: number;
  teamsCount: number;
  currentPlayerIndex: number;
  teamPlayersCount: number;
  format: GameFormat;
  /** Номер хода в круге; осмыслен только втроём. */
  trioTurn: number;
}): Promise<{
  scoreEarned: number;
  newTeamScore: number;
  /** Кому и сколько начислено: втроём здесь две команды, иначе одна. */
  scored: { snapshotId: number; score: number }[];
  nextTeamIndex: number;
  nextRoundNumber: number;
  nextTrioTurn: number;
  nextPlayerIndex: number;
  gameFinished: boolean;
  winnerSnapshotTeamId?: number;
  winnerDbTeamId?: number;
}> {
  const answered = args.round.wordsSeen.filter((w) => w.guessed !== null);
  const guessedCount = answered.filter((w) => w.guessed === true).length;
  const skippedCount = answered.filter((w) => w.guessed === false).length;

  const trio = args.format === "TRIO";

  const { scoreEarned } = scoreRound({
    guessed: guessedCount,
    skipped: skippedCount,
    penaltySkip: args.penaltySkip,
    currentTeamScore: args.teamScoreBefore,
  });

  // Кому засчитать раунд. Втроём это оба игрока пары: и объяснявший, и
  // угадывавший. Отдыхающий не получает ничего.
  const scored = scoredTeamIndexes(args.format, args.trioTurn, args.currentTeamIndex)
    .map((i) => args.teamsAfterUpdate[i])
    .filter((t) => t !== undefined)
    .map((t) => ({
      snapshotId: t.snapshotId,
      dbId: t.dbId,
      score: Math.max(0, t.scoreAfter + scoreEarned),
    }));
  const newTeamScore =
    scored.find((s) => s.snapshotId === args.snapshotTeamId)?.score ??
    Math.max(0, args.teamScoreBefore + scoreEarned);
  const partnerDbTeamId = trio
    ? (args.teamsAfterUpdate[trioRoles(args.trioTurn).guesser]?.dbId ?? null)
    : null;

  // Ход. Втроём круг — шесть ходов: сначала три пары, потом те же три с
  // обменом ролями, — поэтому крутится trioTurn, а currentTeamIndex следует
  // за тем, кто объясняет.
  const nextTrio = trio ? nextTrioTurn(args.trioTurn) : args.trioTurn;
  const { nextTeamIndex, nextRoundNumber } = trio
    ? {
        nextTeamIndex: trioRoles(nextTrio).explainer,
        nextRoundNumber:
          nextTrio === 0 ? args.currentRoundNumber + 1 : args.currentRoundNumber,
      }
    : nextTurn({
        currentTeamIndex: args.currentTeamIndex,
        currentRoundNumber: args.currentRoundNumber,
        teamsCount: args.teamsCount,
      });
  // Конец круга — момент, когда у всех было поровну ходов.
  const circleDone = trio ? nextTrio === 0 : nextTeamIndex === 0;

  const teamsForCheck = args.teamsAfterUpdate.map((t) => {
    const hit = scored.find((s) => s.snapshotId === t.snapshotId);
    return { id: t.snapshotId, score: hit ? hit.score : t.scoreAfter };
  });
  const { gameFinished, winnerTeamId: winnerSnapshotTeamId } = checkWinner({
    teams: teamsForCheck,
    winScore: args.winScore,
    circleDone,
  });

  const newPlayerIndex = nextPlayerIndex(
    args.currentPlayerIndex,
    args.teamPlayersCount,
  );

  const newUsedWordIds = answered.map((w) => w.wordId);

  await prisma.$transaction(async (tx) => {
    await tx.round.create({
      data: {
        gameId: args.gameId,
        teamId: args.dbTeamId,
        partnerTeamId: partnerDbTeamId,
        roundNumber: args.currentRoundNumber,
        playerName: args.round.playerName,
        scoreEarned,
        startedAt: new Date(args.round.startedAt),
        endedAt: new Date(),
        words: {
          create: answered.map((w) => ({
            wordId: w.wordId,
            guessed: w.guessed!,
            order: w.order,
          })),
        },
      },
    });

    // Втроём тут две команды: очки идут и объяснявшему, и угадывавшему.
    // Курсор игрока двигается только у той, что объясняла.
    for (const s of scored) {
      await tx.team.update({
        where: { id: s.dbId },
        data: {
          score: s.score,
          ...(s.dbId === args.dbTeamId ? { currentPlayerIndex: newPlayerIndex } : {}),
        },
      });
    }

    await tx.game.update({
      where: { id: args.gameId },
      data: {
        currentTeamIndex: gameFinished
          ? args.currentTeamIndex
          : nextTeamIndex,
        currentRoundNumber: gameFinished
          ? args.currentRoundNumber
          : nextRoundNumber,
        trioTurn: gameFinished ? args.trioTurn : nextTrio,
        status: gameFinished ? "FINISHED" : "IN_PROGRESS",
        finishedAt: gameFinished ? new Date() : null,
        usedWordIds: { push: newUsedWordIds },
      },
    });
  });

  let winnerDbTeamId: number | undefined;
  if (gameFinished && winnerSnapshotTeamId !== undefined) {
    const winner = args.teamsAfterUpdate.find(
      (t) => t.snapshotId === winnerSnapshotTeamId,
    );
    winnerDbTeamId = winner?.dbId;
  }

  return {
    scoreEarned,
    newTeamScore,
    scored: scored.map((s) => ({ snapshotId: s.snapshotId, score: s.score })),
    nextTeamIndex,
    nextRoundNumber,
    nextTrioTurn: nextTrio,
    nextPlayerIndex: newPlayerIndex,
    gameFinished,
    winnerSnapshotTeamId,
    winnerDbTeamId,
  };
}

