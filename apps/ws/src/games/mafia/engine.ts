// Движок партии Мафии: переходы фаз, резолв ночи, подсчёт голосов, проверка
// победы. Таймеры — через scheduler; по истечении срабатывает onTimeout,
// который диспетчеризует следующий шаг по текущей фазе.

import {
  emptyNightState,
  emptyVoteState,
  type MafiaSnapshot,
  type MafiaWinner,
  type MafiaDeathCause,
  type MafiaPhase,
} from "@alias/shared/mafia";
import { load, mutate } from "./snapshot";
import { broadcastStateNow } from "./broadcast";
import { startTimer, clearTimer, hasTimer } from "./services/scheduler";
import { checkWinner } from "./services/win";
import { persistFinishedGame } from "./services/persist";
import type { MafiaNamespace } from "./io-types";

const MORNING_MS = 5000;
const VOTE_RESULT_MS = 4500;

// ─────────── Чистые помощники (мутируют snap) ───────────

function applyEnterNight(s: MafiaSnapshot): void {
  const prevDoctorTarget = s.night?.doctorTarget;
  const selfHealUsed = s.night?.doctorSelfHealUsed ?? false;
  const sheriffResults = s.night?.sheriffResults ?? {};
  s.day = (s.day ?? 0) + 1;
  s.phase = "NIGHT";
  s.night = emptyNightState();
  s.night.doctorPrevTarget = prevDoctorTarget;
  s.night.doctorSelfHealUsed = selfHealUsed;
  s.night.sheriffResults = sheriffResults;
  s.vote = emptyVoteState();
  s.pendingElim = undefined;
}

function killPlayer(s: MafiaSnapshot, userId: string, cause: MafiaDeathCause): void {
  const p = s.players.find((x) => x.userId === userId);
  if (!p || !p.alive) return;
  p.alive = false;
  p.eliminatedBy = cause;
  p.deathDay = s.day;
  s.deaths.push({
    userId,
    displayName: p.displayName,
    role: p.role ?? "civilian",
    day: s.day,
    by: cause,
  });
}

/** Решение мафии о жертве: голос дона, иначе большинство. */
function decideMafiaTarget(s: MafiaSnapshot): string | undefined {
  const mafiaIds = new Set(
    s.players
      .filter((p) => p.alive && (p.role === "mafia" || p.role === "don"))
      .map((p) => p.userId),
  );
  const don = s.players.find((p) => p.alive && p.role === "don");
  if (don && s.night.mafiaVotes[don.userId]) return s.night.mafiaVotes[don.userId];

  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(s.night.mafiaVotes)) {
    if (!mafiaIds.has(voter)) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [target, c] of Object.entries(counts)) {
    if (c > bestN) {
      bestN = c;
      best = target;
    }
  }
  return best;
}

function resolveNight(s: MafiaSnapshot): void {
  const saved = s.night.doctorTarget;
  const mafiaTarget = decideMafiaTarget(s);
  const maniacTarget = s.night.maniacTarget;
  const causes: Record<string, MafiaDeathCause> = {};
  if (mafiaTarget && mafiaTarget !== saved) causes[mafiaTarget] = "mafia";
  if (maniacTarget && maniacTarget !== saved && !causes[maniacTarget])
    causes[maniacTarget] = "maniac";
  for (const [id, cause] of Object.entries(causes)) killPlayer(s, id, cause);

  // Доктор полечил себя — самолечение израсходовано (переносится в след. ночь).
  const doctor = s.players.find((p) => p.role === "doctor");
  if (saved && doctor && saved === doctor.userId) s.night.doctorSelfHealUsed = true;
}

interface TallyResult {
  leaders: string[];
  eliminated?: string;
  tie: boolean;
}
function tallyVotes(s: MafiaSnapshot): TallyResult {
  const counts: Record<string, number> = {};
  for (const target of Object.values(s.vote.votes)) {
    if (target === "abstain") continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  let max = 0;
  for (const c of Object.values(counts)) max = Math.max(max, c);
  const leaders = Object.keys(counts).filter((k) => counts[k] === max && max > 0);
  if (leaders.length === 1) return { leaders, eliminated: leaders[0], tie: false };
  return { leaders, tie: true };
}

// ─────────── Готовность фазы (ранний переход) ───────────

export function allNightActorsDone(s: MafiaSnapshot): boolean {
  for (const p of s.players) {
    if (!p.alive) continue;
    if (p.role === "mafia" || p.role === "don") {
      if (!s.night.mafiaVotes[p.userId]) return false;
    } else if (p.role === "doctor") {
      if (!s.night.doctorTarget) return false;
    } else if (p.role === "sheriff") {
      if (!s.night.sheriffTarget) return false;
    } else if (p.role === "maniac") {
      if (!s.night.maniacTarget) return false;
    }
  }
  return true;
}

export function allVoted(s: MafiaSnapshot): boolean {
  return s.players
    .filter((p) => p.alive)
    .every((p) => s.vote.votes[p.userId] !== undefined);
}

// ─────────── Переходы фаз (mutate + broadcast + timer) ───────────

export async function enterNight(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await mutate(code, (s) => {
    applyEnterNight(s);
    s.timerEndsAt = Date.now() + s.settings.timers.night * 1000;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, snap.settings.timers.night * 1000, () => onTimeout(ns, code));
}

async function enterMorning(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await mutate(code, (s) => {
    s.phase = "MORNING";
    s.timerEndsAt = Date.now() + MORNING_MS;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, MORNING_MS, () => onTimeout(ns, code));
}

async function enterDiscussion(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await mutate(code, (s) => {
    s.phase = "DISCUSSION";
    s.timerEndsAt = Date.now() + s.settings.timers.discussion * 1000;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, snap.settings.timers.discussion * 1000, () => onTimeout(ns, code));
}

async function afterDiscussion(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  if (snap.settings.rules.firstDayNoVote && snap.day === 1) {
    await enterNight(ns, code);
  } else {
    await enterVote(ns, code, 1, null);
  }
}

async function enterVote(
  ns: MafiaNamespace,
  code: string,
  round: 1 | 2,
  leaders: string[] | null,
): Promise<void> {
  const snap = await mutate(code, (s) => {
    s.phase = "VOTE";
    s.vote = { round, votes: {}, leaders: leaders ?? undefined };
    s.timerEndsAt = Date.now() + s.settings.timers.vote * 1000;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, snap.settings.timers.vote * 1000, () => onTimeout(ns, code));
}

async function tallyPhase(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await mutate(code, (s) => {
    const res = tallyVotes(s);
    s.vote.leaders = res.leaders;
    s.vote.eliminated = res.eliminated;
    s.vote.tie = res.tie;
    s.phase = "VOTE_RESULT";
    s.timerEndsAt = Date.now() + VOTE_RESULT_MS;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, VOTE_RESULT_MS, () => onTimeout(ns, code));
}

async function afterVoteResult(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  if (snap.vote.eliminated) {
    await enterLastWord(ns, code);
  } else if (
    snap.vote.round === 1 &&
    snap.vote.leaders &&
    snap.vote.leaders.length > 1
  ) {
    await enterVote(ns, code, 2, snap.vote.leaders);
  } else {
    await enterNight(ns, code);
  }
}

async function enterLastWord(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await mutate(code, (s) => {
    s.phase = "LAST_WORD";
    s.pendingElim = s.vote.eliminated;
    s.timerEndsAt = Date.now() + s.settings.timers.lastWord * 1000;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, snap.settings.timers.lastWord * 1000, () => onTimeout(ns, code));
}

export async function afterLastWord(ns: MafiaNamespace, code: string): Promise<void> {
  let winner: MafiaWinner | null = null;
  const snap = await mutate(code, (s) => {
    const id = s.pendingElim;
    if (id) killPlayer(s, id, "vote");
    s.pendingElim = undefined;
    winner = checkWinner(s);
  });
  if (!snap) return;
  if (winner) {
    await finishGame(ns, code, winner);
    return;
  }
  await enterNight(ns, code);
}

async function resolveNightPhase(ns: MafiaNamespace, code: string): Promise<void> {
  let winner: MafiaWinner | null = null;
  const snap = await mutate(code, (s) => {
    resolveNight(s);
    winner = checkWinner(s);
  });
  if (!snap) return;
  if (winner) {
    await finishGame(ns, code, winner);
    return;
  }
  await enterMorning(ns, code);
}

export async function finishGame(
  ns: MafiaNamespace,
  code: string,
  winner: MafiaWinner,
): Promise<void> {
  clearTimer(code);
  const snap = await mutate(code, (s) => {
    s.phase = "FINISHED";
    s.winner = winner;
    s.timerEndsAt = undefined;
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  await persistFinishedGame(snap).catch((e) =>
    console.error("[mafia] persist failed", e),
  );
}

// ─────────── Диспетчер по истечении таймера ───────────

export async function onTimeout(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  switch (snap.phase) {
    case "NIGHT":
      await resolveNightPhase(ns, code);
      break;
    case "MORNING":
      await enterDiscussion(ns, code);
      break;
    case "DISCUSSION":
      await afterDiscussion(ns, code);
      break;
    case "VOTE":
      await tallyPhase(ns, code);
      break;
    case "VOTE_RESULT":
      await afterVoteResult(ns, code);
      break;
    case "LAST_WORD":
      await afterLastWord(ns, code);
      break;
    default:
      break;
  }
}

// ─────────── Восстановление таймера ───────────

/** Фазы, которые двигаются таймером и сами по себе не завершатся. */
const TIMED_PHASES: ReadonlySet<MafiaPhase> = new Set<MafiaPhase>([
  "NIGHT",
  "MORNING",
  "DISCUSSION",
  "VOTE",
  "VOTE_RESULT",
  "LAST_WORD",
]);

/**
 * Таймеры живут в памяти процесса, а дедлайн фазы — в снапшоте. После
 * перезапуска ws (деплой, падение) снапшот в Redis цел, но тикать некому,
 * и комната зависла бы навсегда. Вызывается на mafia:hello: если фаза
 * таймерная, а таймера нет — доводим её до конца.
 */
export async function ensurePhaseTimer(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  if (!TIMED_PHASES.has(snap.phase)) return;
  if (snap.timerPaused) return;
  if (hasTimer(code)) return;

  const msLeft = (snap.timerEndsAt ?? 0) - Date.now();
  if (msLeft <= 0) {
    // Дедлайн прошёл, пока сервер лежал — сразу разыгрываем переход.
    await onTimeout(ns, code);
    return;
  }
  startTimer(ns, code, msLeft, () => onTimeout(ns, code));
}

// Ранние переходы — вызываются из обработчиков после действия.
export async function maybeResolveNightEarly(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap || snap.phase !== "NIGHT") return;
  if (allNightActorsDone(snap)) {
    clearTimer(code);
    await resolveNightPhase(ns, code);
  }
}

export async function maybeTallyEarly(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap || snap.phase !== "VOTE") return;
  if (allVoted(snap)) {
    clearTimer(code);
    await tallyPhase(ns, code);
  }
}

export { enterDiscussion, afterDiscussion };
