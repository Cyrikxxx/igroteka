// Движок партии Мафии: переходы фаз с побочными эффектами — запись снапшота,
// рассылка состояния, таймеры. По истечении таймера срабатывает onTimeout,
// который диспетчеризует следующий шаг по текущей фазе.
//
// Чистая часть (резолв ночи, подсчёт голосов, готовность фазы) — в
// engine-core.ts, она покрыта тестами.

import {
  emptyNightState,
  emptyVoteState,
  MAX_MAFIA_PLAYERS,
  NIGHT_SLEEP_MS,
  NIGHT_ANNOUNCE_MS,
  NIGHT_GAP_MS,
  NIGHT_SHERIFF_GAP_MS,
  type MafiaWinner,
  type MafiaPhase,
  type MafiaNightStep,
  type MafiaNightStepRole,
  type MafiaNightAction,
} from "@alias/shared/mafia";
import {
  applyEnterNight,
  killPlayer,
  resolveNight,
  tallyVotes,
  allNightActorsDone,
  allVoted,
  logEvent,
  buildNightPlan,
  nightStepDone,
  nightStepActMs,
} from "./engine-core";
import { load, mutate, remove } from "./snapshot";
import { broadcastStateNow, mafiaRoom } from "./broadcast";
import { startTimer, clearTimer, hasTimer } from "./services/scheduler";
import { checkWinner } from "./services/win";
import { persistFinishedGame } from "./services/persist";
import { reopenRoom, closeRoom as closeRoomRecord } from "../../services/room-lifecycle";
import type { MafiaNamespace } from "./io-types";

const MORNING_MS = 5000;
const VOTE_RESULT_MS = 4500;

// ─────────── Переходы фаз (mutate + broadcast + timer) ───────────

export async function enterNight(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await mutate(code, (s) => {
    applyEnterNight(s);
    if (s.settings.narrator) {
      // За одним столом ночь идёт по шагам: сначала общая команда закрыть
      // глаза, дальше роли по очереди.
      s.night.plan = buildNightPlan(s.settings);
      s.night.step = { role: "sleep", stage: "announce", index: 0, actMs: 0 };
      s.timerEndsAt = Date.now() + NIGHT_SLEEP_MS;
    } else {
      s.timerEndsAt = Date.now() + s.settings.timers.night * 1000;
    }
    s.timerPaused = false;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  const narrated = Boolean(snap.settings.narrator);
  const ms = narrated ? NIGHT_SLEEP_MS : snap.settings.timers.night * 1000;
  startTimer(ns, code, ms, () => onTimeout(ns, code), narrated);
}

// ─────────── Ночь по шагам (режим ведущего) ───────────

/** Тишина после хода. Шерифу дольше: он в эти секунды читает вердикт. */
function nightGapMs(role: MafiaNightStepRole): number {
  return role === "sheriff" ? NIGHT_SHERIFF_GAP_MS : NIGHT_GAP_MS;
}

/** Записать шаг, разослать состояние и завести тихий таймер на его окно. */
async function setNightStep(
  ns: MafiaNamespace,
  code: string,
  step: MafiaNightStep,
  ms: number,
): Promise<void> {
  const snap = await mutate(code, (s) => {
    s.night.step = step;
    s.timerEndsAt = Date.now() + ms;
    s.timerPaused = false;
    s.timerRemainingMs = undefined;
  });
  if (!snap) return;
  await broadcastStateNow(ns, code);
  startTimer(ns, code, ms, () => onTimeout(ns, code), true);
}

/** Перейти к шагу с этим номером; план кончился — разыгрываем ночь. */
async function enterNightStep(
  ns: MafiaNamespace,
  code: string,
  index: number,
): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  const plan = snap.night.plan ?? [];
  if (index >= plan.length) {
    await resolveNightPhase(ns, code);
    return;
  }
  const role = plan[index];
  // Длину окна хода решаем здесь и записываем в шаг: у мёртвой роли она
  // случайная, и перезапуск ws не должен её переигрывать.
  const actMs = role === "sleep" ? 0 : nightStepActMs(snap, role);
  const ms = role === "sleep" ? NIGHT_SLEEP_MS : NIGHT_ANNOUNCE_MS;
  await setNightStep(ns, code, { role, stage: "announce", index, actMs }, ms);
}

/**
 * Следующая стадия ночного шага. Порядок такой:
 *
 *   sleep/announce ──► следующий шаг
 *   роль/announce  ──► act  (окно хода)
 *   роль/act       ──► gap  (тишина, закрываем глаза)
 *   роль/gap       ──► следующий шаг или разыгрываем ночь
 */
async function advanceNightStage(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await load(code);
  if (!snap || snap.phase !== "NIGHT") return;
  const step = snap.night.step;
  if (!step) {
    await resolveNightPhase(ns, code);
    return;
  }

  if (step.stage === "announce" && step.role !== "sleep") {
    // После снятия паузы шаг откатывается к объявлению, и роль могла сходить
    // ещё до неё — тогда открывать окно хода второй раз незачем.
    if (nightStepDone(snap, step.role)) {
      await setNightStep(ns, code, { ...step, stage: "gap" }, nightGapMs(step.role));
      return;
    }
    await setNightStep(ns, code, { ...step, stage: "act" }, step.actMs);
    return;
  }

  if (step.stage === "act") {
    await setNightStep(ns, code, { ...step, stage: "gap" }, nightGapMs(step.role));
    return;
  }

  await enterNightStep(ns, code, step.index + 1);
}

/**
 * Роль сходила — закрываем её окно досрочно и уходим в тишину. Это и есть те
 * три секунды, за которые сходивший закрывает глаза перед вызовом следующего.
 */
export async function maybeEndNightStepEarly(
  ns: MafiaNamespace,
  code: string,
  action: MafiaNightAction,
): Promise<void> {
  const snap = await load(code);
  if (!snap || snap.phase !== "NIGHT") return;
  const step = snap.night.step;
  if (!step || step.stage !== "act" || step.role !== action) return;
  if (!nightStepDone(snap, action)) return;
  clearTimer(code);
  await setNightStep(ns, code, { ...step, stage: "gap" }, nightGapMs(step.role));
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

/**
 * Обсуждение. Им же партия и открывается — до первой ночи, с day = 0: люди
 * успевают познакомиться и договориться, прежде чем кто-то погибнет. Изгонять
 * в этом обсуждении некого и не за что, поэтому голосование после него не
 * наступает (см. afterDiscussion).
 */
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
  // day === 0 — то самое вступительное обсуждение до первой ночи.
  if (snap.day === 0) {
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
    s.vote.skipped = res.skipped;
    if (res.tie) logEvent(s, { kind: "vote_tie" });
    if (res.skipped) logEvent(s, { kind: "vote_skip" });
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
  } else if (snap.vote.skipped) {
    // Город решил никого не изгонять — переголосовывать нечего.
    await enterNight(ns, code);
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
    s.timerRemainingMs = undefined;
    logEvent(s, { kind: "game_over", winner });
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
      if (snap.settings.narrator) await advanceNightStage(ns, code);
      else await resolveNightPhase(ns, code);
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
  // Ночью в режиме ведущего тики не рассылаем и после восстановления.
  const silent = snap.phase === "NIGHT" && Boolean(snap.settings.narrator);
  startTimer(ns, code, msLeft, () => onTimeout(ns, code), silent);
}

// ─────────── Пауза ───────────

/** Остановить таймер фазы, запомнив остаток. */
export async function pausePhase(
  ns: MafiaNamespace,
  code: string,
): Promise<boolean> {
  const current = await load(code);
  if (!current) return false;
  if (!TIMED_PHASES.has(current.phase) || current.timerPaused) return false;

  const remaining = Math.max(0, (current.timerEndsAt ?? 0) - Date.now());
  clearTimer(code);
  const snap = await mutate(code, (s) => {
    s.timerPaused = true;
    s.timerRemainingMs = remaining;
  });
  if (!snap) return false;
  await broadcastStateNow(ns, code);
  return true;
}

/**
 * Продолжить с того же остатка.
 *
 * В режиме ведущего ночью — с оговоркой: стол сидит с закрытыми глазами и
 * молча продолжить не может, роль надо вызвать заново. Поэтому шаг
 * откатывается к объявлению. Ключ реплики при этом совпал бы с уже
 * произнесённым, и все промолчали бы — отсюда счётчик повторов.
 */
export async function resumePhase(
  ns: MafiaNamespace,
  code: string,
): Promise<boolean> {
  const current = await load(code);
  if (!current || !current.timerPaused) return false;

  const recall =
    current.phase === "NIGHT" &&
    Boolean(current.settings.narrator) &&
    Boolean(current.night.step);
  const remaining = recall ? NIGHT_ANNOUNCE_MS : (current.timerRemainingMs ?? 0);
  const snap = await mutate(code, (s) => {
    s.timerPaused = false;
    s.timerRemainingMs = undefined;
    s.timerEndsAt = Date.now() + remaining;
    s.narrationEpoch = (s.narrationEpoch ?? 0) + 1;
    if (recall && s.night.step) s.night.step = { ...s.night.step, stage: "announce" };
  });
  if (!snap) return false;
  await broadcastStateNow(ns, code);
  if (remaining <= 0) {
    await onTimeout(ns, code);
  } else {
    startTimer(ns, code, remaining, () => onTimeout(ns, code), recall);
  }
  return true;
}

/**
 * В комнате не осталось никого на связи — останавливаем партию.
 *
 * Без этого брошенная партия продолжала играть сама с собой: таймеры живут в
 * процессе сервера, фазы сменялись без единого участника, ночью никто не
 * погибал, голосование давало пустой результат — и круг повторялся
 * бесконечно, каждый раз продлевая комнате жизнь.
 */
export async function pauseIfRoomEmpty(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  if (snap.timerPaused) return;
  const anyoneOnline = [...snap.players, ...snap.spectators].some((p) => p.online);
  if (anyoneOnline) return;
  if (!(await pausePhase(ns, code))) return;
  await mutate(code, (s) => {
    s.pausedByEmpty = true;
  });
}

/**
 * Кто-то вернулся — снимаем паузу, поставленную из-за опустевшей комнаты.
 * Хостскую паузу не трогаем: её снимает сам хост.
 */
export async function resumeIfPausedByEmpty(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap?.pausedByEmpty) return;
  await mutate(code, (s) => {
    s.pausedByEmpty = false;
  });
  await resumePhase(ns, code);
}

// ─────────── Новая партия тем же составом ───────────

/**
 * Возврат комнаты в лобби после финала: роли сбрасываются, выбывшие
 * оживают, зрители, подсевшие по ходу партии, становятся игроками.
 */
export async function restartToLobby(
  ns: MafiaNamespace,
  code: string,
): Promise<boolean> {
  // Годится и после финала («сыграть ещё»), и для досрочного обрыва партии
  // хостом. Из лобби возвращать некуда — там и так лобби.
  const current = await load(code);
  if (!current || current.phase === "LOBBY") return false;

  clearTimer(code);
  const snap = await mutate(code, (s) => {
    const returning = [...s.players, ...s.spectators].slice(0, MAX_MAFIA_PLAYERS);
    s.players = returning.map((p, i) => ({
      ...p,
      order: i,
      alive: true,
      ready: false,
      role: null,
      eliminatedBy: undefined,
      deathDay: undefined,
      isHost: p.userId === s.hostId,
    }));
    s.spectators = [];
    s.phase = "LOBBY";
    s.day = 0;
    s.night = emptyNightState();
    s.vote = emptyVoteState();
    s.deaths = [];
    s.events = [];
    s.winner = undefined;
    s.pendingElim = undefined;
    s.timerEndsAt = undefined;
    s.timerPaused = false;
    s.timerRemainingMs = undefined;
  });
  if (!snap) return false;
  // Комната была помечена завершённой при финале — открываем её снова,
  // иначе новые игроки не смогут войти по коду.
  await reopenRoom(code);
  await broadcastStateNow(ns, code);
  return true;
}

/**
 * Хост закрывает комнату: всех отключаем, снимок стираем, комнату в базе
 * помечаем завершённой. У Алиаса это делает DELETE /api/rooms/[code];
 * у Мафии не было никакого способа закончить брошенную партию.
 */
export async function closeRoom(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  clearTimer(code);
  await remove(code);
  await closeRoomRecord(code);

  const sockets = await ns.in(mafiaRoom(code)).fetchSockets();
  for (const s of sockets) {
    s.emit("mafia:closed", { reason: "closed_by_host" });
    s.disconnect(true);
  }
}

// Ранние переходы — вызываются из обработчиков после действия.
export async function maybeResolveNightEarly(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  const snap = await load(code);
  if (!snap || snap.phase !== "NIGHT") return;
  // В режиме ведущего ночь ведут шаги: досрочный резолв здесь оборвал бы её
  // на середине, не вызвав оставшиеся роли.
  if (snap.settings.narrator) return;
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
