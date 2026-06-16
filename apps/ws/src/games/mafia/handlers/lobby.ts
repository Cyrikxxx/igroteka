// События лобби Мафии. Хост: settings/rename/kick/start. Любой: hello/leave/ready.
// Все участники лобби лежат в snap.players (команд нет — у каждого будет роль).

import {
  MIN_MAFIA_PLAYERS,
  MAX_MAFIA_PLAYERS,
  type MafiaSettings,
  type MafiaPlayerFull,
} from "@alias/shared/mafia";
import { mutate, load } from "../snapshot";
import { assignRoles } from "../roles";
import { enterNight } from "../engine";
import { buildView } from "../view";
import {
  scheduleStateBroadcast,
  broadcastStateNow,
  mafiaRoom,
} from "../broadcast";
import type { MafiaSocket, MafiaNamespace } from "../io-types";

function isHost(socket: MafiaSocket): boolean {
  return socket.data.role === "host";
}

/** Валидация частичных настроек от хоста (с клампами). */
function applySettings(s: MafiaSettings, p: unknown): void {
  if (!p || typeof p !== "object") return;
  const x = p as Record<string, unknown>;
  if (x.mafiaCount === "auto") s.mafiaCount = "auto";
  else if (typeof x.mafiaCount === "number")
    s.mafiaCount = Math.max(1, Math.min(8, Math.round(x.mafiaCount)));

  if (x.roles && typeof x.roles === "object") {
    const r = x.roles as Record<string, unknown>;
    if (typeof r.don === "boolean") s.roles.don = r.don;
    if (typeof r.sheriff === "boolean") s.roles.sheriff = r.sheriff;
    if (typeof r.doctor === "boolean") s.roles.doctor = r.doctor;
    if (typeof r.maniac === "boolean") s.roles.maniac = r.maniac;
  }
  if (x.timers && typeof x.timers === "object") {
    const t = x.timers as Record<string, unknown>;
    const clamp = (v: unknown, lo: number, hi: number, d: number) =>
      typeof v === "number" ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
    s.timers.night = clamp(t.night, 15, 180, s.timers.night);
    s.timers.discussion = clamp(t.discussion, 30, 600, s.timers.discussion);
    s.timers.vote = clamp(t.vote, 15, 120, s.timers.vote);
    s.timers.lastWord = clamp(t.lastWord, 10, 90, s.timers.lastWord);
  }
  if (x.rules && typeof x.rules === "object") {
    const ru = x.rules as Record<string, unknown>;
    if (typeof ru.firstDayNoVote === "boolean") s.rules.firstDayNoVote = ru.firstDayNoVote;
    if (typeof ru.revealRoles === "boolean") s.rules.revealRoles = ru.revealRoles;
    if (typeof ru.openVotes === "boolean") s.rules.openVotes = ru.openVotes;
    if (typeof ru.donHiddenFromSheriff === "boolean")
      s.rules.donHiddenFromSheriff = ru.donHiddenFromSheriff;
    if (typeof ru.spectatorsSeeRoles === "boolean")
      s.rules.spectatorsSeeRoles = ru.spectatorsSeeRoles;
  }
}

export function registerMafiaLobbyHandlers(
  ns: MafiaNamespace,
  socket: MafiaSocket,
): void {
  const { userId, roomCode } = socket.data;

  // ─── mafia:hello ─── любой клиент после connect
  socket.on("mafia:hello", async (_payload, ack) => {
    const snap = await mutate(roomCode, (s) => {
      const inPlayers = s.players.find((p) => p.userId === userId);
      const inSpecs = s.spectators.find((p) => p.userId === userId);
      if (inPlayers) {
        inPlayers.online = true;
        return;
      }
      if (inSpecs) {
        inSpecs.online = true;
        return;
      }
      // Новый участник. В лобби — игрок, иначе — зритель.
      const total = s.players.length + s.spectators.length;
      const entry: MafiaPlayerFull = {
        userId,
        displayName: socket.handshake.auth?.name
          ? String((socket.handshake.auth as { name: string }).name).slice(0, 50)
          : userId.slice(0, 6),
        avatarIdx: total,
        order: total,
        online: true,
        alive: true,
        isHost: s.hostId === userId,
        ready: false,
        role: null,
      };
      if (s.phase === "LOBBY") s.players.push(entry);
      else s.spectators.push(entry);
    });
    if (!snap) {
      ack?.({ error: "room_not_found" });
      return;
    }
    // ack отдаёт персональный view сразу; остальным — через mafia:state.
    ack?.(buildView(snap, userId));
    await broadcastStateNow(ns, roomCode);
  });

  // ─── mafia:settings ─── host, только LOBBY
  socket.on("mafia:settings", async (payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });
    const snap = await mutate(roomCode, (s) => applySettings(s.settings, payload));
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:rename ─── host
  socket.on("mafia:rename", async (payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    if (typeof payload?.title !== "string") return ack?.({ error: "invalid_payload" });
    const title = payload.title.trim().slice(0, 80) || null;
    const snap = await mutate(roomCode, (s) => {
      s.title = title;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:kick ─── host, только LOBBY
  socket.on("mafia:kick", async (payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    if (typeof payload?.userId !== "string") return ack?.({ error: "invalid_payload" });
    const target = payload.userId;
    if (target === userId) return ack?.({ error: "cant_kick_self" });
    const current = await load(roomCode);
    if (current && current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });
    const snap = await mutate(roomCode, (s) => {
      s.players = s.players.filter((p) => p.userId !== target);
      s.spectators = s.spectators.filter((p) => p.userId !== target);
      s.players.forEach((p, i) => (p.order = i));
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    // Отключаем сокеты кикнутого.
    const sockets = await ns.in(mafiaRoom(roomCode)).fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === target) {
        s.emit("mafia:closed", { reason: "kicked" });
        s.disconnect(true);
      }
    }
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:leave ─── любой
  socket.on("mafia:leave", async (_payload, ack) => {
    const snap = await mutate(roomCode, (s) => {
      s.players = s.players.filter((p) => p.userId !== userId);
      s.spectators = s.spectators.filter((p) => p.userId !== userId);
      s.players.forEach((p, i) => (p.order = i));
    });
    if (snap) scheduleStateBroadcast(ns, roomCode);
    ack?.({ ok: true });
    socket.disconnect(true);
  });

  // ─── mafia:start ─── host, LOBBY, ≥5 игроков
  socket.on("mafia:start", async (_payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.phase !== "LOBBY") return ack?.({ error: "already_started" });
    if (current.players.length < MIN_MAFIA_PLAYERS)
      return ack?.({ error: "not_enough_players" });
    if (current.players.length > MAX_MAFIA_PLAYERS)
      return ack?.({ error: "too_many_players" });
    const snap = await mutate(roomCode, (s) => assignRoles(s));
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastStateNow(ns, roomCode);
  });

  // ─── mafia:ready ─── игрок подтвердил, что запомнил роль
  socket.on("mafia:ready", async (_payload, ack) => {
    let allReady = false;
    const snap = await mutate(roomCode, (s) => {
      const me = s.players.find((p) => p.userId === userId);
      if (me) me.ready = true;
      if (
        s.phase === "ROLE_REVEAL" &&
        s.players.length > 0 &&
        s.players.every((p) => p.ready)
      ) {
        allReady = true;
      }
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    // Все готовы → первая ночь (engine ставит таймер).
    if (allReady) await enterNight(ns, roomCode);
    else await broadcastStateNow(ns, roomCode);
  });

  // ─── disconnect ─── пометить offline, если других сокетов нет
  socket.on("disconnect", async () => {
    const remaining = await ns.in(mafiaRoom(roomCode)).fetchSockets();
    const stillConnected = remaining.some(
      (s) => s.id !== socket.id && s.data.userId === userId,
    );
    if (stillConnected) return;
    const snap = await mutate(roomCode, (s) => {
      const p =
        s.players.find((x) => x.userId === userId) ??
        s.spectators.find((x) => x.userId === userId);
      if (p) p.online = false;
    });
    if (snap) scheduleStateBroadcast(ns, roomCode);
  });
}
