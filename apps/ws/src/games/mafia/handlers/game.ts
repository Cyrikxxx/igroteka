// Игровые действия Мафии: ночные ходы, дневное голосование, управление
// фазами хостом. Валидация роли/цели/фазы — здесь; переходы — в engine.

import { mutate, load } from "../snapshot";
import { scheduleStateBroadcast } from "../broadcast";
import { clearTimer } from "../services/scheduler";
import {
  maybeResolveNightEarly,
  maybeTallyEarly,
  afterDiscussion,
  afterLastWord,
} from "../engine";
import type { MafiaSocket, MafiaNamespace } from "../io-types";

export function registerMafiaGameHandlers(
  ns: MafiaNamespace,
  socket: MafiaSocket,
): void {
  const { userId, roomCode: code } = socket.data;

  // ─── Ночное действие ───
  socket.on("mafia:night_action", async ({ action, targetId }, ack) => {
    const snap0 = await load(code);
    if (!snap0) return ack?.({ error: "room_not_found" });
    if (snap0.phase !== "NIGHT") return ack?.({ error: "not_night" });
    const me = snap0.players.find((p) => p.userId === userId);
    if (!me || !me.alive) return ack?.({ error: "not_active" });

    const roleOk =
      (action === "mafia" && (me.role === "mafia" || me.role === "don")) ||
      (action === "doctor" && me.role === "doctor") ||
      (action === "sheriff" && me.role === "sheriff") ||
      (action === "maniac" && me.role === "maniac");
    if (!roleOk) return ack?.({ error: "wrong_role" });

    if (targetId !== null) {
      const t = snap0.players.find((p) => p.userId === targetId && p.alive);
      if (!t) return ack?.({ error: "bad_target" });
      if (action === "mafia" && (t.role === "mafia" || t.role === "don"))
        return ack?.({ error: "cant_target_ally" });
      if (
        (action === "mafia" || action === "sheriff" || action === "maniac") &&
        targetId === userId
      )
        return ack?.({ error: "cant_self" });
      if (action === "doctor" && targetId === snap0.night.doctorPrevTarget)
        return ack?.({ error: "no_repeat" });
      if (
        action === "doctor" &&
        targetId === userId &&
        snap0.night.doctorSelfHealUsed
      )
        return ack?.({ error: "no_selfheal" });
    }

    const snap = await mutate(code, (s) => {
      if (action === "mafia") {
        if (targetId === null) delete s.night.mafiaVotes[userId];
        else s.night.mafiaVotes[userId] = targetId;
      } else if (action === "doctor") {
        s.night.doctorTarget = targetId ?? undefined;
      } else if (action === "sheriff") {
        if (targetId === null) {
          s.night.sheriffTarget = undefined;
        } else {
          s.night.sheriffTarget = targetId;
          const t = s.players.find((p) => p.userId === targetId);
          let isMafia = t?.role === "mafia" || t?.role === "don";
          if (t?.role === "don" && s.settings.rules.donHiddenFromSheriff)
            isMafia = false;
          s.night.sheriffResults[targetId] = isMafia;
        }
      } else if (action === "maniac") {
        s.night.maniacTarget = targetId ?? undefined;
      }
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, code);
    await maybeResolveNightEarly(ns, code);
  });

  // ─── Дневной голос ───
  socket.on("mafia:vote", async ({ targetId }, ack) => {
    const snap0 = await load(code);
    if (!snap0) return ack?.({ error: "room_not_found" });
    if (snap0.phase !== "VOTE") return ack?.({ error: "not_vote" });
    const me = snap0.players.find((p) => p.userId === userId);
    if (!me || !me.alive) return ack?.({ error: "not_active" });

    if (targetId !== null && targetId !== "abstain") {
      const t = snap0.players.find((p) => p.userId === targetId && p.alive);
      if (!t) return ack?.({ error: "bad_target" });
      if (targetId === userId) return ack?.({ error: "cant_self" });
      if (
        snap0.vote.round === 2 &&
        snap0.vote.leaders &&
        !snap0.vote.leaders.includes(targetId)
      )
        return ack?.({ error: "not_candidate" });
    }

    const snap = await mutate(code, (s) => {
      if (targetId === null) delete s.vote.votes[userId];
      else s.vote.votes[userId] = targetId;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, code);
    await maybeTallyEarly(ns, code);
  });

  // ─── Хост завершает обсуждение досрочно ───
  socket.on("mafia:end_discussion", async (_p, ack) => {
    const snap = await load(code);
    if (!snap) return ack?.({ error: "room_not_found" });
    if (snap.hostId !== userId) return ack?.({ error: "forbidden" });
    if (snap.phase !== "DISCUSSION") return ack?.({ error: "not_discussion" });
    ack?.({ ok: true });
    clearTimer(code);
    await afterDiscussion(ns, code);
  });

  // ─── Последнее слово сказано (изгнанный или хост) ───
  socket.on("mafia:last_word_done", async (_p, ack) => {
    const snap = await load(code);
    if (!snap) return ack?.({ error: "room_not_found" });
    if (snap.phase !== "LAST_WORD") return ack?.({ error: "not_lastword" });
    if (snap.hostId !== userId && snap.pendingElim !== userId)
      return ack?.({ error: "forbidden" });
    ack?.({ ok: true });
    clearTimer(code);
    await afterLastWord(ns, code);
  });
}
