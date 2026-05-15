// Postgres-мутации игрового цикла: создание Game/Team/Player при старте,
// фиксация раунда при review_confirm. См. PROMPT.md §2.6.1.

import { prisma } from "../prisma";
import type { RoomSnapshot } from "@alias/shared/domain";
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
  const game = await prisma.game.create({
    data: {
      mode: "ONLINE",
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
          name: team.name,
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
 * См. CURRENT_CODE.md §5 — алгоритм идентичен локальной игре.
 */
export async function finalizeRound(args: {
  gameId: string;
  dbTeamId: number;
  snapshotTeamId: number;
  round: RoundState;
  teamScoreBefore: number;
  penaltySkip: boolean;
  winScore: number;
  /** Команды из snapshot'а — нужны для проверки победы (с обновлённым счётом). */
  teamsAfterUpdate: { snapshotId: number; dbId: number; scoreAfter: number }[];
  currentTeamIndex: number;
  currentRoundNumber: number;
  teamsCount: number;
  currentPlayerIndex: number;
  teamPlayersCount: number;
}): Promise<{
  scoreEarned: number;
  newTeamScore: number;
  nextTeamIndex: number;
  nextRoundNumber: number;
  nextPlayerIndex: number;
  gameFinished: boolean;
  winnerSnapshotTeamId?: number;
  winnerDbTeamId?: number;
}> {
  const answered = args.round.wordsSeen.filter((w) => w.guessed !== null);
  const guessedCount = answered.filter((w) => w.guessed === true).length;
  const skippedCount = answered.filter((w) => w.guessed === false).length;

  const { scoreEarned, newTeamScore } = scoreRound({
    guessed: guessedCount,
    skipped: skippedCount,
    penaltySkip: args.penaltySkip,
    currentTeamScore: args.teamScoreBefore,
  });

  const { nextTeamIndex, nextRoundNumber } = nextTurn({
    currentTeamIndex: args.currentTeamIndex,
    currentRoundNumber: args.currentRoundNumber,
    teamsCount: args.teamsCount,
  });

  const teamsForCheck = args.teamsAfterUpdate.map((t) => ({
    id: t.snapshotId,
    score: t.snapshotId === args.snapshotTeamId ? newTeamScore : t.scoreAfter,
  }));
  const { gameFinished, winnerTeamId: winnerSnapshotTeamId } = checkWinner({
    teams: teamsForCheck,
    winScore: args.winScore,
    nextTeamIndex,
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

    await tx.team.update({
      where: { id: args.dbTeamId },
      data: {
        score: newTeamScore,
        currentPlayerIndex: newPlayerIndex,
      },
    });

    await tx.game.update({
      where: { id: args.gameId },
      data: {
        currentTeamIndex: gameFinished
          ? args.currentTeamIndex
          : nextTeamIndex,
        currentRoundNumber: gameFinished
          ? args.currentRoundNumber
          : nextRoundNumber,
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
    nextTeamIndex,
    nextRoundNumber,
    nextPlayerIndex: newPlayerIndex,
    gameFinished,
    winnerSnapshotTeamId,
    winnerDbTeamId,
  };
}

/** При gameFinished — переводим Room в FINISHED. */
export async function finalizeRoom(roomId: string): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { status: "FINISHED", endedAt: new Date() },
  });
}
