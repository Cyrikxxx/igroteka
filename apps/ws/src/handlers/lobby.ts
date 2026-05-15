// События лобби. См. PROMPT.md §2.4.3 (room:*, team:*).
//
// Только host имеет право: team:create, team:rename, team:remove, room:rename.
// Любой участник: team:join (включая null = в зрители).

import type { Namespace } from "socket.io";
import type {
  RoomSnapshot,
  RoomSnapshotTeam,
} from "@alias/shared/domain";
import {
  findPlayer,
  nextTeamId,
  removePlayer,
  nextUnusedTeamColor,
} from "@alias/shared/snapshot-builders";
import {
  MAX_TEAMS,
  MIN_TEAMS,
  MAX_PLAYERS_PER_TEAM,
} from "@alias/shared/constants";
import { mutate, load } from "../snapshot";
import type {
  AppSocket,
  AppNamespace,
} from "../io-types";
import { maybeRehydrateExplainer } from "./round";
import { scheduleStateBroadcast, broadcastStateNow } from "../broadcast";

function isHost(socket: AppSocket): boolean {
  return socket.data.role === "host";
}

function room(socket: AppSocket): string {
  return `room:${socket.data.roomCode}`;
}

// Дебаунс — несколько последовательных мутаций сольются в один state.
async function broadcastState(
  ns: AppNamespace,
  code: string,
  _snap: RoomSnapshot,
): Promise<void> {
  scheduleStateBroadcast(ns, code);
}

export function registerLobbyHandlers(
  ns: AppNamespace,
  socket: AppSocket,
): void {
  const { userId, roomCode } = socket.data;

  // ─── room:hello ─── (любой клиент, после connect) → отдаём snapshot
  socket.on("room:hello", async (_payload, ack) => {
    const snap = await mutate(roomCode, (s) => {
      // Помечаем игрока online; если его нет в snapshot — добавляем как
      // зрителя (на случай переподключения после редкого race).
      const found = findPlayer(s, userId);
      if (found) {
        found.player.online = true;
      } else {
        s.spectators.push({
          userId,
          displayName: userId.slice(0, 6),
          online: true,
          order: s.spectators.length + s.teams.reduce((a, t) => a + t.players.length, 0),
        });
      }
    });
    if (!snap) {
      ack?.({ error: "room_not_found" });
      return;
    }
    ack?.(snap);
    await broadcastState(ns, roomCode, snap);
    // Реконнект explainer'а — пере-эмитим текущее слово приватно.
    await maybeRehydrateExplainer(socket);
  });

  // ─── team:create ─── (host only)
  socket.on("team:create", async (payload, ack) => {
    if (!isHost(socket)) {
      ack?.({ error: "forbidden" });
      return;
    }
    let teamId: number | null = null;
    const snap = await mutate(roomCode, (s) => {
      if (s.teams.length >= MAX_TEAMS) {
        return; // обработаем как ошибку ниже
      }
      const id = nextTeamId(s);
      const team: RoomSnapshotTeam = {
        id,
        name:
          (typeof payload?.name === "string" && payload.name.trim().slice(0, 30)) ||
          `Команда ${s.teams.length + 1}`,
        color:
          typeof payload?.color === "string" && payload.color.startsWith("--")
            ? payload.color
            : nextUnusedTeamColor(s),
        score: 0,
        players: [],
      };
      s.teams.push(team);
      teamId = id;
    });
    if (!snap || teamId === null) {
      ack?.({ error: snap ? "max_teams_reached" : "room_not_found" });
      return;
    }
    ack?.({ ok: true, teamId });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── team:rename ─── (host only)
  socket.on("team:rename", async (payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    if (
      typeof payload?.teamId !== "number" ||
      typeof payload?.name !== "string" ||
      payload.name.trim().length === 0
    ) {
      return ack?.({ error: "invalid_payload" });
    }
    const newName = payload.name.trim().slice(0, 30);
    const snap = await mutate(roomCode, (s) => {
      const team = s.teams.find((t) => t.id === payload.teamId);
      if (!team) return;
      team.name = newName;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── team:remove ─── (host only) → игроки уезжают в зрители
  socket.on("team:remove", async (payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    if (typeof payload?.teamId !== "number") {
      return ack?.({ error: "invalid_payload" });
    }
    const snap = await mutate(roomCode, (s) => {
      const idx = s.teams.findIndex((t) => t.id === payload.teamId);
      if (idx < 0) return;
      const [removed] = s.teams.splice(idx, 1);
      const baseOrder = s.spectators.length;
      removed.players.forEach((p, i) => {
        s.spectators.push({ ...p, order: baseOrder + i });
      });
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── team:join ─── (любой) → перейти в команду или null = в зрители.
  // Разрешено только в LOBBY: иначе можно случайно вылететь из команды
  // в зрители посреди раунда и сломать currentPlayerId / explainer-поток.
  socket.on("team:join", async (payload, ack) => {
    if (
      payload?.teamId !== null &&
      typeof payload?.teamId !== "number"
    ) {
      return ack?.({ error: "invalid_payload" });
    }
    const current = await load(roomCode);
    if (current && current.phase !== "LOBBY") {
      return ack?.({ error: "game_in_progress" });
    }
    const target = payload.teamId;
    const snap = await mutate(roomCode, (s) => {
      const existing = findPlayer(s, userId);
      const displayName =
        existing?.player.displayName ?? userId.slice(0, 6);
      const wasOnline = existing?.player.online ?? true;
      removePlayer(s, userId);

      if (target === null) {
        s.spectators.push({
          userId,
          displayName,
          online: wasOnline,
          order: s.spectators.length,
        });
        return;
      }
      const team = s.teams.find((t) => t.id === target);
      if (!team) {
        // команда исчезла — кладём в зрители как fallback
        s.spectators.push({
          userId,
          displayName,
          online: wasOnline,
          order: s.spectators.length,
        });
        return;
      }
      if (team.players.length >= MAX_PLAYERS_PER_TEAM) {
        // переполнение — fallback в зрители
        s.spectators.push({
          userId,
          displayName,
          online: wasOnline,
          order: s.spectators.length,
        });
        return;
      }
      team.players.push({
        userId,
        displayName,
        online: wasOnline,
        order: team.players.length,
      });
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:rename ─── (host only)
  socket.on("room:rename", async (payload, ack) => {
    if (!isHost(socket)) return ack?.({ error: "forbidden" });
    if (typeof payload?.title !== "string") {
      return ack?.({ error: "invalid_payload" });
    }
    const title = payload.title.trim().slice(0, 80) || null;
    const snap = await mutate(roomCode, (s) => {
      s.title = title;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:leave ─── (любой)
  socket.on("room:leave", async (_payload, ack) => {
    const snap = await mutate(roomCode, (s) => {
      removePlayer(s, userId);
    });
    if (snap) await broadcastState(ns, roomCode, snap);
    ack?.({ ok: true });
    socket.disconnect(true);
  });

  // На disconnect — помечаем offline только если у этого userId не
  // осталось других активных сокетов в комнате. Иначе двойная вкладка
  // (или HMR-перезагрузка одной из них) сбрасывала бы счётчик online
  // и кнопка «Начать игру» прыгала в disabled.
  socket.on("disconnect", async () => {
    const remaining = await ns.in(`room:${roomCode}`).fetchSockets();
    const stillConnected = remaining.some(
      (s) =>
        (s as unknown as { id: string }).id !== socket.id &&
        (s as unknown as { data: { userId: string } }).data.userId === userId,
    );
    if (stillConnected) return;
    const snap = await mutate(roomCode, (s) => {
      const found = findPlayer(s, userId);
      if (found) found.player.online = false;
    });
    if (snap) await broadcastState(ns, roomCode, snap);
  });

  // Подавляем "unused MIN_TEAMS" (нужен для UI-валидации старта игры,
  // которая будет в следующих сессиях).
  void MIN_TEAMS;
}
