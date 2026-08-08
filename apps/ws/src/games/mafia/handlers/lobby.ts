// События лобби Мафии. Хост: settings/rename/kick/start. Любой: hello/leave/ready.
// Все участники лобби лежат в snap.players (команд нет — у каждого будет роль).

import {
  MIN_MAFIA_PLAYERS,
  MAX_MAFIA_PLAYERS,
  type MafiaSettings,
  type MafiaPlayerFull,
  type MafiaSnapshot,
  type MafiaWinner,
} from "@alias/shared/mafia";
import { mutate, load } from "../snapshot";
import { assignRoles } from "../roles";
import {
  enterNight,
  ensurePhaseTimer,
  finishGame,
  maybeResolveNightEarly,
  maybeTallyEarly,
  restartToLobby,
} from "../engine";
import { checkWinner } from "../services/win";

/** Хост ушёл — передаём комнату первому, кто ещё на связи. */
function transferHostIfNeeded(s: MafiaSnapshot, leavingUserId: string): void {
  if (s.hostId !== leavingUserId) return;
  const heir = s.players.find((p) => p.online && p.userId !== leavingUserId);
  if (!heir) return;
  s.hostId = heir.userId;
  s.players.forEach((p) => (p.isHost = p.userId === heir.userId));
}
import { buildView } from "../view";
import {
  scheduleStateBroadcast,
  broadcastStateNow,
  mafiaRoom,
} from "../broadcast";
import type { MafiaSocket, MafiaNamespace } from "../io-types";

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
    const before = await load(roomCode);
    if (!before) return ack?.({ error: "room_not_found" });

    const known =
      before.players.some((p) => p.userId === userId) ||
      before.spectators.some((p) => p.userId === userId);
    if (!known) {
      // Выгнанный хостом не должен возвращаться: токен у него остался
      // рабочим, и без этой проверки кик ничего бы не значил.
      if (before.banned?.includes(userId)) return ack?.({ error: "kicked" });
      // Лобби заполнено. Пускать сверх лимита нельзя — старт всё равно
      // отказал бы, и хосту пришлось бы вычищать лишних руками.
      if (before.phase === "LOBBY" && before.players.length >= MAX_MAFIA_PLAYERS) {
        return ack?.({ error: "room_full" });
      }
    }

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
      // Аватар считаем от максимального занятого, а не от количества:
      // после чьего-то ухода счётчик повторился бы и два игрока получили
      // бы одинаковую картинку.
      const nextAvatar =
        [...s.players, ...s.spectators].reduce(
          (max, p) => Math.max(max, p.avatarIdx),
          -1,
        ) + 1;
      const entry: MafiaPlayerFull = {
        userId,
        displayName: socket.handshake.auth?.name
          ? String((socket.handshake.auth as { name: string }).name).slice(0, 50)
          : userId.slice(0, 6),
        avatarIdx: nextAvatar,
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

    // Хост мог выйти, когда в комнате не осталось никого, кому передать
    // права: тогда hostId указывает на ушедшего, и начать игру некому.
    // Чиним при первом же появлении живого игрока.
    const withHost = await mutate(roomCode, (s) => {
      if (s.players.length === 0) return;
      if (s.players.some((p) => p.userId === s.hostId)) return;
      const heir = s.players.find((p) => p.online) ?? s.players[0];
      s.hostId = heir.userId;
      s.players.forEach((p) => (p.isHost = p.userId === heir.userId));
    });
    if (!snap) {
      ack?.({ error: "room_not_found" });
      return;
    }
    // ack отдаёт персональный view сразу; остальным — через mafia:state.
    ack?.(buildView(withHost ?? snap, userId));
    await broadcastStateNow(ns, roomCode);
    // Если процесс ws перезапускался посреди партии, таймер фазы потерялся
    // вместе с памятью — заводим его заново по дедлайну из снапшота.
    await ensurePhaseTimer(ns, roomCode);
  });

  // ─── mafia:settings ─── host, только LOBBY
  socket.on("mafia:settings", async (payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });
    const snap = await mutate(roomCode, (s) => applySettings(s.settings, payload));
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:rename ─── host
  socket.on("mafia:rename", async (payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
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
    if (typeof payload?.userId !== "string") return ack?.({ error: "invalid_payload" });
    const target = payload.userId;
    if (target === userId) return ack?.({ error: "cant_kick_self" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });
    const snap = await mutate(roomCode, (s) => {
      s.players = s.players.filter((p) => p.userId !== target);
      s.spectators = s.spectators.filter((p) => p.userId !== target);
      s.players.forEach((p, i) => (p.order = i));
      // Помним, кого выгнали: иначе он просто переподключится тем же токеном.
      s.banned = [...(s.banned ?? []), target];
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
  // В лобби ушедшего просто вычёркиваем. В идущей партии вычёркивать нельзя:
  // вместе с игроком пропала бы его роль, а условие победы никто бы не
  // пересчитал (ушла последняя мафия — партия висит вечно). Поэтому в игре
  // помечаем выбывшим, как при смерти, и сразу проверяем победу.
  socket.on("mafia:leave", async (_payload, ack) => {
    let winner: MafiaWinner | null = null;
    const snap = await mutate(roomCode, (s) => {
      s.spectators = s.spectators.filter((p) => p.userId !== userId);

      const inGame = s.phase !== "LOBBY" && s.phase !== "FINISHED";
      const me = s.players.find((p) => p.userId === userId);

      if (!inGame || !me) {
        s.players = s.players.filter((p) => p.userId !== userId);
        s.players.forEach((p, i) => (p.order = i));
      } else if (me.alive) {
        me.alive = false;
        me.online = false;
        me.eliminatedBy = "left";
        me.deathDay = s.day;
        s.deaths.push({
          userId: me.userId,
          displayName: me.displayName,
          role: me.role ?? "civilian",
          day: s.day,
          by: "left",
        });
        // Снимаем его незакрытые ходы, иначе фаза будет ждать призрака.
        delete s.night.mafiaVotes[userId];
        delete s.vote.votes[userId];
        if (s.night.doctorTarget && me.role === "doctor") s.night.doctorTarget = undefined;
        if (s.night.sheriffTarget && me.role === "sheriff") s.night.sheriffTarget = undefined;
        if (s.night.maniacTarget && me.role === "maniac") s.night.maniacTarget = undefined;
      } else {
        me.online = false;
      }

      transferHostIfNeeded(s, userId);
      // Только в идущей партии: в лобби роли ещё не розданы, и checkWinner
      // принял бы «нет живой мафии» за победу города.
      if (inGame) winner = checkWinner(s);
    });

    ack?.({ ok: true });
    socket.disconnect(true);
    if (!snap) return;

    if (winner) {
      await finishGame(ns, roomCode, winner);
      return;
    }
    scheduleStateBroadcast(ns, roomCode);
    // Ушедший мог быть последним, кого ждала фаза.
    await maybeResolveNightEarly(ns, roomCode);
    await maybeTallyEarly(ns, roomCode);
  });

  // ─── mafia:start ─── host, LOBBY, ≥5 игроков
  socket.on("mafia:start", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
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

  // ─── mafia:restart ─── host, только после финала
  socket.on("mafia:restart", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase !== "FINISHED") return ack?.({ error: "not_finished" });
    const ok = await restartToLobby(ns, roomCode);
    ack?.(ok ? { ok: true } : { error: "cant_restart" });
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
  // Обрыв связи НЕ выводит из игры: у человека мог переключиться Wi-Fi, и
  // он вернётся тем же userId. Выбывшим делает только явный mafia:leave.
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
      transferHostIfNeeded(s, userId);
    });
    if (snap) scheduleStateBroadcast(ns, roomCode);
  });
}
