// Игровой цикл онлайн-партии Алиаса: серверная машина состояний
// LOBBY → PRE_ROUND → ROUND_ACTIVE → ROUND_REVIEW → BETWEEN_ROUNDS → FINISHED.
//
// Главные события (client→server): round:start_game, round:guess,
// round:pause, round:resume, round:end, round:review_toggle,
// round:review_confirm.
// Главные бродкасты (server→client): round:phase, round:tick,
// round:word (приватно), round:word_count, round:review, round:committed.

import type {
  RoomSnapshot,
  RoomSnapshotTeam,
  RoundReviewWord,
} from "@alias/shared/domain";
import {
  MIN_TEAMS,
  MIN_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
} from "@alias/shared/constants";
import { trioRoles } from "@alias/shared/trio";
import {
  findPlayer,
  removePlayer,
  nextExplainerFor,
} from "@alias/shared/snapshot-builders";
import { mutate, load, save } from "../snapshot";
import { prisma } from "../../../prisma";
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
import { createGameFromSnapshot, finalizeRound } from "../services/game";
import { closeRoom } from "../../../services/room-lifecycle";
import type { AppSocket, AppNamespace } from "../io-types";

const BETWEEN_ROUNDS_MS = 4000;

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Права хоста проверяем по снапшоту, а не по роли из WS-токена. Токен
 * выдаётся один раз при входе в комнату, поэтому после передачи хоста он
 * соврал бы в обе стороны: прежний владелец остался бы «host» и сохранил
 * все кнопки, а новый их не получил бы.
 */
async function isHost(code: string, userId: string): Promise<boolean> {
  const snap = await load(code);
  return snap?.hostId === userId;
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
    currentGuesserId: snap.currentGuesserId ?? null,
    durationMs,
  });
}

function teamByIndex(snap: RoomSnapshot, idx: number): RoomSnapshotTeam | null {
  return snap.teams[idx] ?? null;
}

/**
 * Кто угадывает на ходу `turn`. Только втроём: в обычном режиме угадывает
 * вся команда объясняющего, и одного человека тут не назвать.
 */
function guesserIdFor(snap: RoomSnapshot, turn: number): string | null {
  if ((snap.format ?? "TEAMS") !== "TRIO") return null;
  return snap.teams[trioRoles(turn).guesser]?.players[0]?.userId ?? null;
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

  const trio = (initial.format ?? "TEAMS") === "TRIO";
  if (trio) {
    // Втроём мест ровно три и все должны быть заняты: пара на каждый ход
    // задана правилами круга, подставить вместо выбывшего некого.
    const occupied = initial.teams.filter((t) =>
      t.players.some((p) => p.online),
    ).length;
    if (initial.teams.length !== TRIO_TEAMS || occupied !== TRIO_TEAMS) {
      return { error: `need_${TRIO_TEAMS}_online_players` };
    }
  } else {
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

  // Между проверкой и переносом offline в зрители игрок мог отвалиться, и
  // команда осталась бы пустой. Втроём это особенно вероятно: на месте всего
  // один человек. Проверяем до записи в Postgres, чтобы не оставить висячую
  // партию.
  const firstTeam = prepped.teams[0];
  const firstExplainer = firstTeam?.players[0]; // playerCursor=0 после префа.
  if (!firstTeam || !firstExplainer || prepped.teams.some((t) => t.players.length === 0)) {
    return { error: "player_left_before_start" };
  }

  // Postgres: создаём Game/Team/Player. Нужен roomId — берём из Postgres
  // (snapshot хранит только code).
  const room = await prisma.room.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!room) return { error: "room_not_found_db" };

  const { gameId, teamIdMap } = await createGameFromSnapshot(prepped, room.id);

  // Обновляем snapshot: фаза PRE_ROUND, currentTeamIndex=0, gameId, teamIdMap.
  const updated = await mutate(code, (s) => {
    s.status = "IN_GAME";
    s.phase = "PRE_ROUND";
    s.gameId = gameId;
    s.teamIdMap = teamIdMap;
    s.currentTeamIndex = 0;
    s.trioTurn = 0;
    s.currentTeamId = firstTeam.id;
    s.currentPlayerId = firstExplainer.userId;
    s.currentGuesserId = guesserIdFor(s, 0);
    s.currentRoundNumber = 1;
    s.scoreboard = { teamId: firstTeam.id, got: 0, skip: 0 };
  });
  if (!updated) return { error: "snapshot_lost" };

  // Без отсчёта 3-2-1: сразу запускаем раунд. Фаза уже PRE_ROUND в snapshot —
  // enterRoundActive переведёт в ROUND_ACTIVE и разошлёт состояние, по которому
  // лобби редиректит игроков на /play.
  await enterRoundActive(ns, code);
  return { ok: true };
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
    // Объясняющий мог отвалиться в те секунды, что идут между раундами:
    // передачу хода мы бы не пропустили, а вот здесь раунд стартовал бы с
    // горящим таймером и без человека. Начинаем сразу на паузе — снимет её
    // он сам, когда вернётся.
    pausedAt: explainerPlayer?.online === false ? Date.now() : null,
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
    s.timer = { msLeft: roundState.durationMs, paused: roundState.pausedAt !== null };
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
  if (rs.explainerUserId !== userId && !(await isHost(code, userId))) {
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
  if (rs.explainerUserId !== userId && !(await isHost(code, userId))) {
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

/**
 * Объясняющий пропал из сети — ставим раунд на паузу. Время не должно гореть,
 * пока человека нет: он вернётся в тот же раунд и досказывает своё слово.
 *
 * Снимает паузу он сам кнопкой «Продолжить» — автоматически возобновлять
 * нельзя, иначе первые секунды сгорят, пока у него грузится страница.
 */
export async function pauseIfExplainerDropped(
  ns: AppNamespace,
  code: string,
  droppedUserId: string,
): Promise<void> {
  const rs = await loadRoundState(code);
  if (!rs) return;
  if (rs.explainerUserId !== droppedUserId) return;
  if (rs.pausedAt !== null) return;

  rs.pausedAt = Date.now();
  await saveRoundState(code, rs);
  const snap = await mutate(code, (s) => {
    if (s.timer) s.timer.paused = true;
  });
  if (snap) broadcastState(ns, code, snap);
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
  if (rs.explainerUserId !== userId && !(await isHost(code, userId))) {
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

  // Передавать ход некому: следующий объясняющий не в сети. Раунд не
  // фиксируем и остаёмся на итогах — иначе ход ушёл бы человеку, который его
  // не увидит, и партия встала бы без объясняющего. Клиент блокирует кнопку
  // тем же правилом; здесь — на случай, если его обойдут.
  const next = nextExplainerFor(snap);
  if (next && !next.player.online) {
    return { error: "next_explainer_offline" };
  }

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
    format: snap.format ?? "TEAMS",
    trioTurn: snap.trioTurn ?? 0,
  });

  // Обновляем snapshot: счёт команды, playerCursor этой команды,
  // currentTeamIndex/currentTeamId/currentPlayerId, phase=BETWEEN_ROUNDS.
  const nextTeam = snap.teams[result.nextTeamIndex];
  const nextPlayerCursor = nextTeam?.playerCursor ?? 0;
  const nextExplainer = nextTeam?.players[nextPlayerCursor];

  const committed = await mutate(code, (s) => {
    // Втроём очки получают оба игрока пары, поэтому счёт обновляем по списку,
    // а курсор игрока двигаем только у того, кто объяснял.
    for (const scored of result.scored) {
      const team = s.teams.find((x) => x.id === scored.snapshotId);
      if (team) team.score = scored.score;
    }
    const t = s.teams.find((x) => x.id === rs.teamId);
    if (t) t.playerCursor = result.nextPlayerIndex;
    if (result.gameFinished) {
      s.phase = "FINISHED";
      s.status = "FINISHED";
      s.timer = null;
      s.scoreboard = null;
    } else {
      s.phase = "BETWEEN_ROUNDS";
      s.currentTeamIndex = result.nextTeamIndex;
      s.trioTurn = result.nextTrioTurn;
      s.currentTeamId = nextTeam?.id ?? null;
      s.currentPlayerId = nextExplainer?.userId ?? null;
      s.currentGuesserId = guesserIdFor(s, result.nextTrioTurn);
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
    // Комната в Postgres переходит в FINISHED — код освобождается.
    await closeRoom(code);
    return { ok: true };
  }

  // BETWEEN_ROUNDS → сразу ROUND_ACTIVE через 4 секунды (без отсчёта 3-2-1)
  setTimeout(() => {
    void (async () => {
      const fresh = await load(code);
      if (!fresh || fresh.phase !== "BETWEEN_ROUNDS") return;
      const next = await mutate(code, (s) => {
        s.phase = "PRE_ROUND";
      });
      if (!next) return;
      await enterRoundActive(ns, code);
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
  await closeRoom(code);
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

  // Пауза и снятие паузы касаются всей комнаты, а не только нажавшего:
  // остальные должны увидеть, что время встало или снова пошло. Раньше
  // состояние только записывалось в снапшот и никому не рассылалось.
  socket.on("round:pause", async (_payload, ack) => {
    const res = await handlePause(socket);
    ack?.(res);
    if ("ok" in res) {
      const snap = await load(socket.data.roomCode);
      if (snap) broadcastState(ns, socket.data.roomCode, snap);
    }
  });
  socket.on("round:resume", async (_payload, ack) => {
    const res = await handleResume(socket);
    ack?.(res);
    if ("ok" in res) {
      const snap = await load(socket.data.roomCode);
      if (snap) broadcastState(ns, socket.data.roomCode, snap);
    }
  });
  socket.on("round:end", async (_payload, ack) => {
    const res = await handleEnd(ns, socket);
    ack?.(res);
  });

  // ─── round:end_game ─── оборвать партию досрочно, доступно любому в игре
  //
  // Единственный рычаг, когда партия ждёт человека, который не возвращается:
  // выйти посреди игры нельзя — состав заморожен, иначе ломается очередь
  // объясняющих. Раньше рычаг был только у хоста, и стол оставался запертым,
  // если хост ушёл первым или сам оказался тем, кого ждут.
  //
  // Доступна каждому, кто в комнате. Счёт остаётся текущим, все попадают на
  // экран итогов, откуда хост уже существующей «Сыграть ещё» возвращает
  // комнату в лобби.
  socket.on("round:end_game", async (_payload, ack) => {
    const code = socket.data.roomCode;
    const snap = await load(code);
    if (!snap) return ack?.({ error: "room_not_found" });
    if (snap.phase === "LOBBY" || snap.phase === "FINISHED") {
      return ack?.({ error: "not_in_game" });
    }
    ack?.({ ok: true });
    await endGame(ns, code, "ended_by_host");
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
