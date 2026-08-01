// Чистая часть движка Мафии: функции, которые только читают и мутируют
// снапшот — без Redis, сокетов и таймеров. Вынесены отдельно, чтобы их
// можно было покрыть тестами; побочные эффекты живут в engine.ts.

import {
  emptyNightState,
  emptyVoteState,
  type MafiaSnapshot,
  type MafiaDeathCause,
} from "@alias/shared/mafia";

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

  // Доктор полечил себя — самолечение израсходовано (переносится в след. ночь).
  const doctor = s.players.find((p) => p.role === "doctor");
  if (saved && doctor && saved === doctor.userId) s.night.doctorSelfHealUsed = true;
}

export interface TallyResult {
  leaders: string[];
  eliminated?: string;
  tie: boolean;
}

/** Подсчёт дневных голосов. Один лидер — изгнание, несколько — ничья. */
export function tallyVotes(s: MafiaSnapshot): TallyResult {
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

export function allVoted(s: MafiaSnapshot): boolean {
  return s.players
    .filter((p) => p.alive)
    .every((p) => s.vote.votes[p.userId] !== undefined);
}
