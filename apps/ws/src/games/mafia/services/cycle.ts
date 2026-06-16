// Переходы фаз партии Мафии. В фазе 2 — только вход в ночь (старт после
// раздачи ролей). Резолв ночи/дня и авто-переходы добавляются в фазах 3–4.

import {
  emptyNightState,
  emptyVoteState,
  type MafiaSnapshot,
} from "@alias/shared/mafia";

/** Перейти в ночь (день+1). Переносит накопленные данные шерифа/доктора. */
export function enterNight(snap: MafiaSnapshot): void {
  const prevDoctorTarget = snap.night?.doctorTarget;
  const selfHealUsed = snap.night?.doctorSelfHealUsed ?? false;
  const sheriffResults = snap.night?.sheriffResults ?? {};

  snap.day = (snap.day ?? 0) + 1;
  snap.phase = "NIGHT";
  snap.night = emptyNightState();
  snap.night.doctorPrevTarget = prevDoctorTarget;
  snap.night.doctorSelfHealUsed = selfHealUsed;
  snap.night.sheriffResults = sheriffResults;
  snap.vote = emptyVoteState();
  snap.timerEndsAt = Date.now() + snap.settings.timers.night * 1000;
  snap.timerPaused = false;
}
