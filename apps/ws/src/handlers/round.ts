// Игровой цикл онлайн. Состояния и переходы — PROMPT.md §2.6.1.
//
// Главные события (client→server): round:start_game, round:guess,
// round:pause, round:resume, round:end, round:review_toggle,
// round:review_confirm.
// Главные бродкасты (server→client): round:phase, round:countdown,
// round:tick, round:word (приватно), round:word_count, round:review,
// round:committed.

import type {
  RoomSnapshot,
  RoomSnapshotTeam,
  RoundReviewWord,
} from "@alias/shared/domain";
import {
  MIN_TEAMS,
  MIN_PLAYERS_PER_TEAM,
} from "@alias/shared/constants";
import { findPlayer, removePlayer } from "@alias/shared/snapshot-builders";
import { mutate, load, save } from "../snapshot";
import { prisma } from "../prisma";
import {
  fetchWordsBatch,
  pushWordsToQueue,
  popNextWord,
  clearWordsQueue,
} from "../services/word";
import {
  saveRoundState,
  loadRoundState,
  deleteRoundState,
  msLeft,
  type RoundState,
  type WordSeen,
} from "../services/roundState";
import { startTimer, stopTimer } from "../services/timer";
import {
  createGameFromSnapshot,
  finalizeRound,
  finalizeRoom,
} from "../services/game";
import type { AppSocket, AppNamespace } from "../io-types";

const PRE_ROUND_SECONDS = 3;
const BETWEEN_ROUNDS_MS = 4000;

// ─── Helpers ──────────────────────────────────────────────────────────────

function isHost(socket: AppSocket): boolean {
  return socket.data.role === "host";
}

async function findExplainerSocket(
  ns: AppNamespace,
  code: string,
  userId: string,
): Promise<AppSocket | null> {
  const sockets = await ns.in(`room:${code}`).fetchSockets();
  const found = sockets.find((s) => s.data.userId === userId);
  return (found as unknown as AppSocket) ?? null;
}

function broadcastState(ns: AppNamespace, code: string, snap: RoomSnapshot) {
  ns.to(`room:${code}`).emit("room:state", snap);
}

function broadcastPhase(
  ns: AppNamespace,
  code: string,
  snap: RoomSnapshot,
  durationMs?: number,
) {
  ns.to(`room:${code}`).emit("round:phase", {
    phase: snap.phase,
    roundNumber: snap.currentRoundNumber,
    currentTeamId: snap.currentTeamId,
    currentPlayerId: snap.currentPlayerId,
    durationMs,
  });
}

function teamByIndex(snap: RoomSnapshot, idx: number): RoomSnapshotTeam | null {
  return snap.teams[idx] ?? null;
}

// ─── Game start: LOBBY → PRE_ROUND ────────────────────────────────────────

async function startGame(
  ns: AppNamespace,
  code: string,
  hostUserId: string,
): Promise<{ ok: true } | { error: string }> {
  const initial = await load(code);
  if (!initial) return { error: "room_not_found" };
  if (initial.hostId !== hostUserId) return { error: "forbidden" };
  if (initial.status !== "LOBBY" || initial.phase !== "LOBBY") {
    return { error: "already_started" };
  }

  // Валидация: ≥2 команды, ≥2 онлайн-игрока в каждой; offline → в зрители.
  if (initial.teams.length < MIN_TEAMS) {
    return { error: `need_min_${MIN_TEAMS}_teams` };
  }
  for (const team of initial.teams) {
    const onlineCount = team.players.filter((p) => p.online).length;
    if (onlineCount < MIN_PLAYERS_PER_TEAM) {
      return { error: `need_min_${MIN_PLAYERS_PER_TEAM}_online_per_team` };
    }
  }

  // Двигаем offline игроков в spectators перед стартом.
  const prepped = await mutate(code, (s) => {
    for (const team of s.teams) {
      team.players = team.players.filter((p) => {
        if (!p.online) {
          s.spectators.push({ ...p, order: s.spectators.length });
          return false;
        }
        return true;
      });
      // Сбрасываем playerCursor в начало
      team.playerCursor = 0;
    }
  });
  if (!prepped) return { error: "snapshot_lost" };

  // Postgres: создаём Game/Team/Player. Нужен roomId — берём из Postgres
  // (snapshot хранит только code).
  const room = await prisma.room.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!room) return { error: "room_not_found_db" };

  const { gameId, teamIdMap } = await createGameFromSnapshot(prepped, room.id);

  // Обновляем snapshot: фаза PRE_ROUND, currentTeamIndex=0, gameId, teamIdMap.
  const firstTeam = prepped.teams[0];
  const firstExplainer = firstTeam.players[0]; // playerCursor=0 после префа.
  const updated = await mutate(code, (s) => {
    s.status = "IN_GAME";
    s.phase = "PRE_ROUND";
    s.gameId = gameId;
    s.teamIdMap = teamIdMap;
    s.currentTeamIndex = 0;
    s.currentTeamId = firstTeam.id;
    s.currentPlayerId = firstExplainer.userId;
    s.currentRoundNumber = 1;
    s.scoreboard = { teamId: firstTeam.id, got: 0, skip: 0 };
  });
  if (!updated) return { error: "snapshot_lost" };

  broadcastState(ns, code, updated);
  broadcastPhase(ns, code, updated);

  // PRE_ROUND countdown: 3, 2, 1 → ROUND_ACTIVE
  scheduleCountdown(ns, code, PRE_ROUND_SECONDS);
  return { ok: true };
}

function scheduleCountdown(
  ns: AppNamespace,
  code: string,
  seconds: number,
): void {
  // Эмитим первое значение сразу, потом каждую секунду до 0.
  let remaining = seconds;
  ns.to(`room:${code}`).emit("round:countdown", { secondsLeft: remaining });
  const id = setInterval(async () => {
    remaining -= 1;
    if (remaining > 0) {
      ns.to(`room:${code}`).emit("round:countdown", {
        secondsLeft: remaining,
      });
      return;
    }
    clearInterval(id);
    await enterRoundActive(ns, code);
  }, 1000);
}

// ─── PRE_ROUND → ROUND_ACTIVE ─────────────────────────────────────────────

async function enterRoundActive(
  ns: AppNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap || snap.phase !== "PRE_ROUND" || !snap.gameId) return;

  // Тащим пакет слов
  const batch = await fetchWordsBatch(snap.gameId);
  if (batch.length === 0) {
    // Нет слов — завершаем игру.
    await endGame(ns, code, "no_words");
    return;
  }
  await pushWordsToQueue(code, batch);

  // Первое слово — приватно explainer'у
  const firstWord = await popNextWord(code);
  if (!firstWord) {
    await endGame(ns, code, "no_words");
    return;
  }

  const team = snap.currentTeamId
    ? snap.teams.find((t) => t.id === snap.currentTeamId)
    : null;
  const explainerUserId = snap.currentPlayerId!;
  const explainerPlayer = team?.players.find(
    (p) => p.userId === explainerUserId,
  );

  const roundState: RoundState = {
    teamId: snap.currentTeamId!,
    explainerUserId,
    playerName: explainerPlayer?.displayName ?? "Unknown",
    roundNumber: snap.currentRoundNumber,
    durationMs: snap.settings.roundTime * 1000,
    startedAt: Date.now(),
    pausedAt: null,
    pausedTotalMs: 0,
    wordsSeen: [
      {
        wordId: firstWord.id,
        text: firstWord.text,
        guessed: null,
        order: 0,
      },
    ],
    currentWordId: firstWord.id,
    currentWordText: firstWord.text,
    currentWordOrder: 0,
  };
  await saveRoundState(code, roundState);

  const updated = await mutate(code, (s) => {
    s.phase = "ROUND_ACTIVE";
    s.timer = { msLeft: roundState.durationMs, paused: false };
    s.scoreboard = { teamId: s.currentTeamId!, got: 0, skip: 0 };
  });
  if (!updated) return;

  broadcastState(ns, code, updated);
  broadcastPhase(ns, code, updated, roundState.durationMs);

  // Приватный emit первого слова
  const explainerSocket = await findExplainerSocket(
    ns,
    code,
    explainerUserId,
  );
  explainerSocket?.emit("round:word", {
    wordId: firstWord.id,
    text: firstWord.text,
    index: 1,
    total: batch.length,
  });

  // Запускаем тики
  startTimer(code, async () => {
    const rs = await loadRoundState(code);
    if (!rs) {
      stopTimer(code);
      return;
    }
    if (rs.pausedAt !== null) return; // На паузе — не тикаем
    const left = msLeft(rs);
    ns.to(`room:${code}`).emit("round:tick", { msLeft: left });
    if (left <= 0) {
      stopTimer(code);
      await finishRound(ns, code, "timeout");
    }
  }, 250);
}

// ─── round:guess ──────────────────────────────────────────────────────────

async function handleGuess(
  ns: AppNamespace,
  socket: AppSocket,
  payload: { wordId: number; guessed: boolean },
): Promise<{ ok: true; nextWord: null } | { error: string }> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return { error: "no_active_round" };
  if (rs.explainerUserId !== userId) return { error: "not_explainer" };
  if (rs.pausedAt !== null) return { error: "paused" };
  if (rs.currentWordId !== payload.wordId) {
    // Уже отвечено или рассинхрон — отвергаем.
    return { error: "stale_word" };
  }

  // Фиксируем результат текущего слова
  const seen = rs.wordsSeen[rs.wordsSeen.length - 1];
  if (seen) seen.guessed = Boolean(payload.guessed);

  // Достаём следующее
  const next = await popNextWord(code);
  if (!next) {
    rs.currentWordId = null;
    rs.currentWordText = null;
    await saveRoundState(code, rs);
    // Слова закончились — досрочный финиш раунда
    await finishRound(ns, code, "exhausted");
    return { ok: true, nextWord: null };
  }
  const nextOrder = rs.currentWordOrder + 1;
  rs.wordsSeen.push({
    wordId: next.id,
    text: next.text,
    guessed: null,
    order: nextOrder,
  });
  rs.currentWordId = next.id;
  rs.currentWordText = next.text;
  rs.currentWordOrder = nextOrder;
  await saveRoundState(code, rs);

  // Считаем счёт в scoreboard и эмитим word_count всем
  const got = rs.wordsSeen.filter((w) => w.guessed === true).length;
  const skip = rs.wordsSeen.filter((w) => w.guessed === false).length;
  const left = msLeft(rs);
  await mutate(code, (s) => {
    if (s.scoreboard) {
      s.scoreboard.got = got;
      s.scoreboard.skip = skip;
    }
  });
  ns.to(`room:${code}`).emit("round:word_count", { got, skip, msLeft: left });

  // Приватный emit следующего слова
  socket.emit("round:word", {
    wordId: next.id,
    text: next.text,
    index: nextOrder + 1,
    total: nextOrder + 1, // приблизительно — точное знать не обязательно
  });
  return { ok: true, nextWord: null };
}

// ─── round:pause / resume ─────────────────────────────────────────────────

async function handlePause(
  socket: AppSocket,
): Promise<{ ok: true } | { error: string }> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return { error: "no_active_round" };
  // Pause: только хост или explainer
  if (rs.explainerUserId !== userId && socket.data.role !== "host") {
    return { error: "forbidden" };
  }
  if (rs.pausedAt !== null) return { ok: true };
  rs.pausedAt = Date.now();
  await saveRoundState(code, rs);
  await mutate(code, (s) => {
    if (s.timer) s.timer.paused = true;
  });
  return { ok: true };
}

async function handleResume(
  socket: AppSocket,
): Promise<{ ok: true } | { error: string }> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return { error: "no_active_round" };
  if (rs.explainerUserId !== userId && socket.data.role !== "host") {
    return { error: "forbidden" };
  }
  if (rs.pausedAt === null) return { ok: true };
  rs.pausedTotalMs += Date.now() - rs.pausedAt;
  rs.pausedAt = null;
  await saveRoundState(code, rs);
  await mutate(code, (s) => {
    if (s.timer) s.timer.paused = false;
  });
  return { ok: true };
}

// ─── round:end (досрочный завершить раунд) ────────────────────────────────

async function handleEnd(
  ns: AppNamespace,
  socket: AppSocket,
): Promise<{ ok: true } | { error: string }> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return { error: "no_active_round" };
  if (rs.explainerUserId !== userId && socket.data.role !== "host") {
    return { error: "forbidden" };
  }
  stopTimer(code);
  await finishRound(ns, code, "ended_early");
  return { ok: true };
}

// ─── ROUND_ACTIVE → ROUND_REVIEW ──────────────────────────────────────────

async function finishRound(
  ns: AppNamespace,
  code: string,
  _reason: string,
): Promise<void> {
  stopTimer(code);
  const rs = await loadRoundState(code);
  if (!rs) return;

  // Если последнее слово всё ещё показано (guessed=null) — считаем пропуском.
  for (const w of rs.wordsSeen) {
    if (w.guessed === null) w.guessed = false;
  }
  await saveRoundState(code, rs);

  const snap = await load(code);
  if (!snap) return;

  // Подготовка превью результата
  const guessedCount = rs.wordsSeen.filter((w) => w.guessed).length;
  const skippedCount = rs.wordsSeen.filter((w) => w.guessed === false).length;
  const scorePreview =
    guessedCount - (snap.settings.penaltySkip ? skippedCount : 0);

  const reviewWords: RoundReviewWord[] = rs.wordsSeen.map((w) => ({
    wordId: w.wordId,
    text: w.text,
    guessed: w.guessed ?? false,
    order: w.order,
  }));

  const updated = await mutate(code, (s) => {
    s.phase = "ROUND_REVIEW";
    if (s.timer) s.timer.paused = true;
  });
  if (!updated) return;

  broadcastState(ns, code, updated);
  broadcastPhase(ns, code, updated);

  ns.to(`room:${code}`).emit("round:review", {
    teamId: rs.teamId,
    words: reviewWords,
    scorePreview,
  });
}

// ─── round:review_toggle / confirm ────────────────────────────────────────

async function handleReviewToggle(
  ns: AppNamespace,
  socket: AppSocket,
  payload: { wordId: number },
): Promise<{ ok: true } | { error: string }> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return { error: "no_active_round" };
  if (rs.explainerUserId !== userId) return { error: "not_explainer" };
  const snap = await load(code);
  if (!snap || snap.phase !== "ROUND_REVIEW") {
    return { error: "wrong_phase" };
  }
  const w = rs.wordsSeen.find((x) => x.wordId === payload.wordId);
  if (!w || w.guessed === null) return { error: "word_not_found" };
  w.guessed = !w.guessed;
  await saveRoundState(code, rs);

  const guessedCount = rs.wordsSeen.filter((x) => x.guessed === true).length;
  const skippedCount = rs.wordsSeen.filter((x) => x.guessed === false).length;
  const scorePreview =
    guessedCount - (snap.settings.penaltySkip ? skippedCount : 0);

  ns.to(`room:${code}`).emit("round:review", {
    teamId: rs.teamId,
    words: rs.wordsSeen.map((x) => ({
      wordId: x.wordId,
      text: x.text,
      guessed: x.guessed === true,
      order: x.order,
    })),
    scorePreview,
  });
  return { ok: true };
}

async function handleReviewConfirm(
  ns: AppNamespace,
  socket: AppSocket,
): Promise<{ ok: true } | { error: string }> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return { error: "no_active_round" };
  if (rs.explainerUserId !== userId) return { error: "not_explainer" };
  const snap = await load(code);
  if (!snap || snap.phase !== "ROUND_REVIEW") {
    return { error: "wrong_phase" };
  }
  if (!snap.gameId || !snap.teamIdMap) {
    return { error: "missing_game_or_teammap" };
  }
  const dbTeamId = snap.teamIdMap[rs.teamId];
  if (!dbTeamId) return { error: "team_id_not_mapped" };

  // Готовим данные для финализации
  const snapTeam = snap.teams.find((t) => t.id === rs.teamId);
  if (!snapTeam) return { error: "team_not_in_snapshot" };
  const teamPlayersCount = snapTeam.players.length;
  const currentPlayerIndex = snapTeam.playerCursor ?? 0;
  const teamsAfterUpdate = snap.teams.map((t) => ({
    snapshotId: t.id,
    dbId: snap.teamIdMap![t.id],
    scoreAfter: t.score,
  }));

  const result = await finalizeRound({
    gameId: snap.gameId,
    dbTeamId,
    snapshotTeamId: rs.teamId,
    round: rs,
    teamScoreBefore: snapTeam.score,
    penaltySkip: snap.settings.penaltySkip,
    winScore: snap.settings.winScore,
    teamsAfterUpdate,
    currentTeamIndex: snap.currentTeamIndex ?? 0,
    currentRoundNumber: snap.currentRoundNumber,
    teamsCount: snap.teams.length,
    currentPlayerIndex,
    teamPlayersCount,
  });

  // Обновляем snapshot: счёт команды, playerCursor этой команды,
  // currentTeamIndex/currentTeamId/currentPlayerId, phase=BETWEEN_ROUNDS.
  const nextTeam = snap.teams[result.nextTeamIndex];
  const nextPlayerCursor = nextTeam?.playerCursor ?? 0;
  const nextExplainer = nextTeam?.players[nextPlayerCursor];

  const committed = await mutate(code, (s) => {
    const t = s.teams.find((x) => x.id === rs.teamId);
    if (t) {
      t.score = result.newTeamScore;
      t.playerCursor = result.nextPlayerIndex;
    }
    if (result.gameFinished) {
      s.phase = "FINISHED";
      s.status = "FINISHED";
      s.timer = null;
      s.scoreboard = null;
    } else {
      s.phase = "BETWEEN_ROUNDS";
      s.currentTeamIndex = result.nextTeamIndex;
      s.currentTeamId = nextTeam?.id ?? null;
      s.currentPlayerId = nextExplainer?.userId ?? null;
      s.currentRoundNumber = result.nextRoundNumber;
      s.timer = null;
      s.scoreboard = nextTeam
        ? { teamId: nextTeam.id, got: 0, skip: 0 }
        : null;
    }
  });
  if (!committed) return { error: "snapshot_lost" };

  await deleteRoundState(code);
  await clearWordsQueue(code);

  // Соберём snapshot-id победителя из dbTeamId
  let winnerSnapshotTeamId: number | undefined;
  if (result.gameFinished && result.winnerSnapshotTeamId !== undefined) {
    winnerSnapshotTeamId = result.winnerSnapshotTeamId;
  }

  ns.to(`room:${code}`).emit("round:committed", {
    teamId: rs.teamId,
    scoreEarned: result.scoreEarned,
    teamScore: result.newTeamScore,
    nextTeamId: committed.currentTeamId,
    nextRoundNumber: result.nextRoundNumber,
    gameFinished: result.gameFinished,
    winnerTeamId: winnerSnapshotTeamId,
    gameId: snap.gameId,
  });

  broadcastState(ns, code, committed);
  broadcastPhase(ns, code, committed);

  if (result.gameFinished) {
    // Закрываем комнату в Postgres (status=FINISHED).
    const room = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });
    if (room) await finalizeRoom(room.id);
    return { ok: true };
  }

  // BETWEEN_ROUNDS → PRE_ROUND через 4 секунды
  setTimeout(() => {
    void (async () => {
      const fresh = await load(code);
      if (!fresh || fresh.phase !== "BETWEEN_ROUNDS") return;
      const next = await mutate(code, (s) => {
        s.phase = "PRE_ROUND";
      });
      if (!next) return;
      broadcastState(ns, code, next);
      broadcastPhase(ns, code, next);
      scheduleCountdown(ns, code, PRE_ROUND_SECONDS);
    })();
  }, BETWEEN_ROUNDS_MS);

  return { ok: true };
}

// ─── Fallback: завершить игру когда слов больше нет вообще ────────────────

async function endGame(
  ns: AppNamespace,
  code: string,
  _reason: string,
): Promise<void> {
  stopTimer(code);
  await deleteRoundState(code);
  await clearWordsQueue(code);
  const snap = await mutate(code, (s) => {
    s.phase = "FINISHED";
    s.status = "FINISHED";
    s.timer = null;
    s.scoreboard = null;
  });
  if (snap) {
    broadcastState(ns, code, snap);
    broadcastPhase(ns, code, snap);
  }
  const room = await prisma.room.findUnique({
    where: { code },
    select: { id: true },
  });
  if (room) await finalizeRoom(room.id);
}

// ─── Регистрация обработчиков на каждый сокет ────────────────────────────

export function registerRoundHandlers(
  ns: AppNamespace,
  socket: AppSocket,
): void {
  socket.on("round:start_game", async (_payload, ack) => {
    const res = await startGame(ns, socket.data.roomCode, socket.data.userId);
    ack?.(res);
  });

  socket.on("round:guess", async (payload, ack) => {
    const res = await handleGuess(ns, socket, payload);
    if ("error" in res) ack?.(res);
    else ack?.({ ok: true, nextWord: null });
  });

  socket.on("round:pause", async (_payload, ack) => {
    const res = await handlePause(socket);
    ack?.(res);
  });
  socket.on("round:resume", async (_payload, ack) => {
    const res = await handleResume(socket);
    ack?.(res);
  });
  socket.on("round:end", async (_payload, ack) => {
    const res = await handleEnd(ns, socket);
    ack?.(res);
  });

  socket.on("round:review_toggle", async (payload, ack) => {
    const res = await handleReviewToggle(ns, socket, payload);
    ack?.(res);
  });
  socket.on("round:review_confirm", async (_payload, ack) => {
    const res = await handleReviewConfirm(ns, socket);
    ack?.(res);
  });

  // Реэмит текущего слова при реконнекте делает lobby.ts через
  // `maybeRehydrateExplainer` после ack'а room:hello.
}

/** Вспомогательная функция: после `room:hello` если есть активный раунд и
 * этот сокет — explainer, послать ему текущее слово. */
export async function maybeRehydrateExplainer(
  socket: AppSocket,
): Promise<void> {
  const code = socket.data.roomCode;
  const userId = socket.data.userId;
  const rs = await loadRoundState(code);
  if (!rs) return;
  if (rs.explainerUserId !== userId) return;
  if (rs.currentWordId === null || rs.currentWordText === null) return;
  socket.emit("round:word", {
    wordId: rs.currentWordId,
    text: rs.currentWordText,
    index: rs.currentWordOrder + 1,
    total: rs.currentWordOrder + 1,
  });
}

// Подавляем "unused"
void save;
void findPlayer;
void removePlayer;
