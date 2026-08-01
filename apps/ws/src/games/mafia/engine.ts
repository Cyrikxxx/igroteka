// Движок партии Мафии: переходы фаз с побочными эффектами — запись снапшота,
// рассылка состояния, таймеры. По истечении таймера срабатывает onTimeout,
// который диспетчеризует следующий шаг по текущей фазе.
//
// Чистая часть (резолв ночи, подсчёт голосов, готовность фазы) — в
// engine-core.ts, она покрыта тестами.

import type { MafiaWinner, MafiaPhase } from "@alias/shared/mafia";
import {
  applyEnterNight,
  killPlayer,
  resolveNight,
  tallyVotes,
  allNightActorsDone,
  allVoted,
} from "./engine-core";
import { load, mutate } from "./snapshot";
import { broadcastStateNow } from "./broadcast";
import { startTimer, clearTimer, hasTimer } from "./services/scheduler";
import { checkWinner } from "./services/win";
import { persistFinishedGame } from "./services/persist";
import type { MafiaNamespace } from "./io-types";

const MORNING_MS = 5000;
const VOTE_RESULT_MS = 4500;

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
