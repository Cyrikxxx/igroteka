// Чистая часть движка Мафии: функции, которые только читают и мутируют
// снапшот — без Redis, сокетов и таймеров. Вынесены отдельно, чтобы их
// можно было покрыть тестами; побочные эффекты живут в engine.ts.

import {
  emptyNightState,
  emptyVoteState,
  NIGHT_IDLE_MIN_MS,
  type MafiaSnapshot,
  type MafiaDeathCause,
  type MafiaEvent,
  type MafiaSettings,
  type MafiaNightStepRole,
  SKIP_VOTE,
} from "@alias/shared/mafia";

/** Дописать запись в журнал партии. Журнал никогда не уходит живым игрокам. */
export function logEvent(s: MafiaSnapshot, event: Omit<MafiaEvent, "day">): void {
  if (!s.events) s.events = [];
  s.events.push({ day: s.day, ...event });
}

/** Переводит снапшот в новую ночь, перенося «память» ролей с прошлой. */
export function applyEnterNight(s: MafiaSnapshot): void {
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
  logEvent(s, { kind: "night_fell" });
}

export function killPlayer(
  s: MafiaSnapshot,
  userId: string,
  cause: MafiaDeathCause,
): void {
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
  logEvent(s, {
    kind: cause === "vote" ? "exile" : cause === "left" ? "left" : "kill",
    displayName: p.displayName,
    role: p.role ?? "civilian",
    cause,
  });
}

/**
 * Игрок покидает партию навсегда (сам вышел или хост вывел зависшего).
 * Вычёркивать его из состава нельзя — пропала бы роль и сбился подсчёт
 * победы, поэтому помечаем выбывшим и снимаем незакрытые ходы, чтобы
 * фаза не ждала того, кого уже нет.
 */
export function eliminateLeaver(s: MafiaSnapshot, userId: string): void {
  const me = s.players.find((p) => p.userId === userId);
  if (!me) return;
  if (me.alive) killPlayer(s, userId, "left");
  me.online = false;
  delete s.night.mafiaVotes[userId];
  delete s.vote.votes[userId];
  if (me.role === "doctor") s.night.doctorTarget = undefined;
  if (me.role === "sheriff") s.night.sheriffTarget = undefined;
  if (me.role === "maniac") s.night.maniacTarget = undefined;
}

/** Решение мафии о жертве: голос дона решающий, иначе большинство. */
export function decideMafiaTarget(s: MafiaSnapshot): string | undefined {
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

/** Разыгрывает ночь: лечение отменяет убийство той же цели. */
export function resolveNight(s: MafiaSnapshot): void {
  const saved = s.night.doctorTarget;
  const mafiaTarget = decideMafiaTarget(s);
  const maniacTarget = s.night.maniacTarget;
  const causes: Record<string, MafiaDeathCause> = {};
  if (mafiaTarget && mafiaTarget !== saved) causes[mafiaTarget] = "mafia";
  if (maniacTarget && maniacTarget !== saved && !causes[maniacTarget])
    causes[maniacTarget] = "maniac";
  for (const [id, cause] of Object.entries(causes)) killPlayer(s, id, cause);

  // Спасение доктора попадает в журнал, только если оно что-то изменило.
  const wasAttacked = saved && (mafiaTarget === saved || maniacTarget === saved);
  if (wasAttacked) {
    const rescued = s.players.find((p) => p.userId === saved);
    logEvent(s, { kind: "save", actor: "doctor", displayName: rescued?.displayName });
  }
  if (Object.keys(causes).length === 0) logEvent(s, { kind: "no_deaths" });

  // Доктор полечил себя — самолечение израсходовано (переносится в след. ночь).
  const doctor = s.players.find((p) => p.role === "doctor");
  if (saved && doctor && saved === doctor.userId) s.night.doctorSelfHealUsed = true;
}

export interface TallyResult {
  /** Лидеры голосования. Среди них может быть SKIP_VOTE. */
  leaders: string[];
  eliminated?: string;
  /** Победил скип — день кончается, но никто не выбывает. */
  skipped: boolean;
  tie: boolean;
}

/**
 * Подсчёт дневных голосов. Один лидер — изгнание, несколько — ничья.
 *
 * Скип считается наравне с игроками: город решает не только «кого», но и
 * «стоит ли вообще». Когда правило выключено, голоса за скип не учитываются
 * вовсе — как будто человек не голосовал.
 */
export function tallyVotes(s: MafiaSnapshot): TallyResult {
  const skipAllowed = s.settings.rules.allowSkipVote;
  const counts: Record<string, number> = {};
  for (const target of Object.values(s.vote.votes)) {
    if (target === SKIP_VOTE && !skipAllowed) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  let max = 0;
  for (const c of Object.values(counts)) max = Math.max(max, c);
  const leaders = Object.keys(counts).filter((k) => counts[k] === max && max > 0);
  if (leaders.length !== 1) return { leaders, skipped: false, tie: leaders.length > 1 };
  const winner = leaders[0]!;
  if (winner === SKIP_VOTE) return { leaders, skipped: true, tie: false };
  return { leaders, eliminated: winner, skipped: false, tie: false };
}

/** Все ли, кто ходит ночью, уже сходили — можно ли резолвить раньше таймера. */
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

// ─────────── Шаги ночи (режим ведущего) ───────────

/**
 * Порядок ролей на ночь. Берётся ИЗ НАСТРОЕК, а не из живых: мёртвую роль
 * ведущий зовёт наравне с живой. Строй план по живым — и первая же ночь без
 * доктора объявила бы столу, что доктора больше нет.
 */
export function buildNightPlan(settings: MafiaSettings): MafiaNightStepRole[] {
  const plan: MafiaNightStepRole[] = ["sleep", "mafia"];
  if (settings.roles.doctor) plan.push("doctor");
  if (settings.roles.sheriff) plan.push("sheriff");
  if (settings.roles.maniac) plan.push("maniac");
  return plan;
}

/** Живые носители роли этого шага. */
function stepActors(s: MafiaSnapshot, role: MafiaNightStepRole) {
  if (role === "mafia")
    return s.players.filter((p) => p.alive && (p.role === "mafia" || p.role === "don"));
  if (role === "sleep") return [];
  return s.players.filter((p) => p.alive && p.role === role);
}

/** Есть ли кому ходить на этом шаге. */
export function nightStepHasActor(s: MafiaSnapshot, role: MafiaNightStepRole): boolean {
  return stepActors(s, role).length > 0;
}

/**
 * Все ли, кого зовёт этот шаг, уже сходили. Шаг без живых носителей никогда
 * не «готов»: пустой every() иначе завершал бы его мгновенно — ровно то, по
 * чему стол и вычислил бы, что роли нет.
 */
export function nightStepDone(s: MafiaSnapshot, role: MafiaNightStepRole): boolean {
  const actors = stepActors(s, role);
  if (actors.length === 0) return false;
  if (role === "mafia") return actors.every((p) => Boolean(s.night.mafiaVotes[p.userId]));
  if (role === "doctor") return Boolean(s.night.doctorTarget);
  if (role === "sheriff") return Boolean(s.night.sheriffTarget);
  if (role === "maniac") return Boolean(s.night.maniacTarget);
  return false;
}

/**
 * Длина окна хода. Живой роли — полный шаг из настроек; мёртвой — случайное
 * время, иначе её шаг проскакивал бы мгновенно и выдавал бы себя.
 * `rnd` вынесен параметром, чтобы тест мог подставить свой генератор.
 */
export function nightStepActMs(
  s: MafiaSnapshot,
  role: MafiaNightStepRole,
  rnd: () => number = Math.random,
): number {
  const full = s.settings.timers.nightStep * 1000;
  if (nightStepHasActor(s, role)) return full;
  const min = Math.min(NIGHT_IDLE_MIN_MS, full);
  return Math.round(min + rnd() * (full - min));
}

export function allVoted(s: MafiaSnapshot): boolean {
  return s.players
    .filter((p) => p.alive)
    .every((p) => s.vote.votes[p.userId] !== undefined);
}
