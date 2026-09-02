// События лобби Алиаса: room:* и team:*.
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
  nextUnusedTeamName,
  reassignHostIfNeeded,
  everyoneIn,
  applyRoomFormat,
  teamCapacity,
} from "@alias/shared/snapshot-builders";
import {
  MAX_TEAMS,
  MIN_TEAMS,
} from "@alias/shared/constants";
import { nextHostOfflineSince, canClaimHost } from "@alias/shared/host";
import { mutate, load, remove } from "../snapshot";
import { reopenRoom, closeRoom } from "../../../services/room-lifecycle";
import type {
  AppSocket,
  AppNamespace,
} from "../io-types";
import { maybeRehydrateExplainer, pauseIfExplainerDropped } from "./round";
import { scheduleStateBroadcast, broadcastStateNow } from "../broadcast";

/**
 * Права хоста проверяем по снапшоту, а не по роли из WS-токена. Токен
 * выдаётся один раз при входе в комнату, поэтому после передачи хоста он
 * соврал бы в обе стороны: прежний владелец остался бы «host» и сохранил
 * все кнопки, а новый их не получил бы.
 */
async function isHost(code: string, userId: string): Promise<boolean> {
  const snap = await load(code);
  return snap?.hostId === userId;
}

function room(socket: AppSocket): string {
  return `room:${socket.data.roomCode}`;
}

/** Хост на связи? Отсюда берётся отсчёт «комната зависла». */
function isHostOnline(s: RoomSnapshot): boolean {
  return findPlayer(s, s.hostId)?.player.online ?? false;
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
    // Выгнанный переподключился бы тем же токеном — проверяем до мутации.
    const before = await load(roomCode);
    if (before?.banned?.some((b) => b.userId === userId)) {
      ack?.({ error: "kicked" });
      socket.emit("room:closed", { reason: "kicked" });
      socket.disconnect(true);
      return;
    }
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
      // Хост вернулся — отсчёт «комната зависла» снимаем, и кнопка «взять
      // комнату на себя» у остальных пропадает.
      s.hostOfflineSince = nextHostOfflineSince({
        hostOnline: isHostOnline(s),
        current: s.hostOfflineSince,
      });
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

  /**
   * Втроём набор команд задан: три места, свои добавлять и убирать нельзя.
   * Возвращаем внятную ошибку, а не молча игнорируем.
   */
  async function trioLocked(): Promise<boolean> {
    const snap = await load(roomCode);
    return snap?.format === "TRIO";
  }

  // ─── team:create ─── (host only)
  socket.on("team:create", async (payload, ack) => {
    if (!(await isHost(roomCode, userId))) {
      ack?.({ error: "forbidden" });
      return;
    }
    if (await trioLocked()) {
      ack?.({ error: "trio_locked" });
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
          nextUnusedTeamName(s.teams.map((t) => t.name)),
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
    if (!(await isHost(roomCode, userId))) return ack?.({ error: "forbidden" });
    if (await trioLocked()) return ack?.({ error: "trio_locked" });
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
    if (!(await isHost(roomCode, userId))) return ack?.({ error: "forbidden" });
    if (await trioLocked()) return ack?.({ error: "trio_locked" });
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
      // Втроём место рассчитано на одного — вместимость зависит от формата.
      if (team.players.length >= teamCapacity(s.format)) {
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

  // ─── room:format ─── (host only, только в LOBBY) → командами / втроём
  socket.on("room:format", async (payload, ack) => {
    if (!(await isHost(roomCode, userId))) return ack?.({ error: "forbidden" });
    if (payload?.format !== "TEAMS" && payload?.format !== "TRIO") {
      return ack?.({ error: "invalid_payload" });
    }
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });
    if ((current.format ?? "TEAMS") === payload.format) return ack?.({ ok: true });

    const snap = await mutate(roomCode, (s) => {
      applyRoomFormat(s, payload.format);
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:set_name ─── (любой, только в LOBBY) → свой ник
  // Имя задаётся один раз при входе и потом нигде не редактировалось: чтобы
  // исправить опечатку, приходилось пересоздавать комнату.
  socket.on("room:set_name", async (payload, ack) => {
    if (typeof payload?.displayName !== "string") {
      return ack?.({ error: "invalid_payload" });
    }
    const name = payload.displayName.trim().slice(0, 50);
    if (!name) return ack?.({ error: "invalid_payload" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    // В идущей партии переименование запутало бы всех: имя уже уехало в
    // Postgres вместе с составом команд.
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });

    const snap = await mutate(roomCode, (s) => {
      const found = findPlayer(s, userId);
      if (found) found.player.displayName = name;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:rename ─── (host only)
  socket.on("room:rename", async (payload, ack) => {
    if (!(await isHost(roomCode, userId))) return ack?.({ error: "forbidden" });
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

  // ─── room:settings ─── (host only, только в LOBBY) → правила партии
  socket.on("room:settings", async (payload, ack) => {
    if (!(await isHost(roomCode, userId))) return ack?.({ error: "forbidden" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });

    const snap = await mutate(roomCode, (s) => {
      if (
        typeof payload?.roundTime === "number" &&
        payload.roundTime >= 10 &&
        payload.roundTime <= 300
      ) {
        s.settings.roundTime = Math.round(payload.roundTime);
      }
      if (
        typeof payload?.winScore === "number" &&
        payload.winScore >= 0 &&
        payload.winScore <= 1000
      ) {
        s.settings.winScore = Math.round(payload.winScore);
      }
      if (typeof payload?.penaltySkip === "boolean") {
        s.settings.penaltySkip = payload.penaltySkip;
      }
      if (Array.isArray(payload?.categoryIds)) {
        const ids = payload.categoryIds
          .map((x) => Number(x))
          .filter((n) => Number.isInteger(n) && n > 0);
        if (ids.length > 0) s.settings.categoryIds = ids;
      }
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:leave ─── (любой)
  // ─── room:restart ─── (host only, только из FINISHED)
  // Зеркало restartToLobby у Мафии: собираем состав внутри mutate под
  // локом, а не читаем его заранее — иначе тот, кто вышел, пока хост жал
  // кнопку, вернулся бы в лобби.
  socket.on("room:restart", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase !== "FINISHED") return ack?.({ error: "not_finished" });

    const snap = await mutate(roomCode, (s) => {
      s.teams.forEach((t) => {
        t.score = 0;
        t.playerCursor = 0;
      });
      s.phase = "LOBBY";
      s.status = "LOBBY";
      s.currentTeamId = null;
      s.currentPlayerId = null;
      s.currentTeamIndex = 0;
      s.currentRoundNumber = 1;
      s.timer = null;
      s.scoreboard = null;
      // Новая партия — новая строка Game; старая остаётся в истории.
      s.gameId = null;
      s.teamIdMap = undefined;
    });
    if (!snap) return ack?.({ error: "room_not_found" });

    // Партия доигралась — комнату пометили FINISHED. Без этого REST-вход
    // отвечал бы новым игрокам 410, хотя идёт сбор на следующую.
    await reopenRoom(roomCode);
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:close ─── (host only) — комната закрывается для всех
  socket.on("room:close", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });

    ack?.({ ok: true });
    await remove(roomCode);
    await closeRoom(roomCode);
    const sockets = await ns.in(`room:${roomCode}`).fetchSockets();
    for (const sock of sockets) {
      sock.emit("room:closed", { reason: "closed_by_host" });
      sock.disconnect(true);
    }
  });

  // ─── room:kick ─── (host only, только в лобби)
  // Посреди партии не даём: у команды есть очередь объясняющих
  // (playerCursor), и выдёргивание игрока её сломает. Для отвалившихся
  // в игре есть баннер «отключился → завершить раунд».
  socket.on("room:kick", async (payload, ack) => {
    if (typeof payload?.userId !== "string") return ack?.({ error: "invalid_payload" });
    const target = payload.userId;
    if (target === userId) return ack?.({ error: "cant_kick_self" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });

    const snap = await mutate(roomCode, (s) => {
      // Имя запоминаем вместе с id: хост должен видеть, кого возвращает.
      const gone = removePlayer(s, target);
      if (gone) {
        s.banned = [...(s.banned ?? []), { userId: target, displayName: gone.displayName }];
      }
    });
    if (!snap) return ack?.({ error: "room_not_found" });

    const sockets = await ns.in(`room:${roomCode}`).fetchSockets();
    for (const sock of sockets) {
      if ((sock as unknown as { data: { userId: string } }).data.userId === target) {
        sock.emit("room:closed", { reason: "kicked" });
        sock.disconnect(true);
      }
    }
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:unban ─── (host only)
  // Кик обратим: выгнали по ошибке — вернули, не пересоздавая комнату.
  socket.on("room:unban", async (payload, ack) => {
    if (typeof payload?.userId !== "string") return ack?.({ error: "invalid_payload" });
    const target = payload.userId;
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });

    const snap = await mutate(roomCode, (s) => {
      s.banned = (s.banned ?? []).filter((b) => b.userId !== target);
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:claim_host ─── (любой в комнате, когда хост давно не в сети)
  // Обрыв связи хоста прав не отнимает — иначе комната слетала бы от любого
  // моргнувшего Wi-Fi. Но и ждать пропавшего вечно нельзя: без хоста нельзя
  // ни начать игру, ни поменять настройки. Поэтому забрать комнату может сам
  // участник — руками и не раньше чем через минуту.
  socket.on("room:claim_host", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    const claimer = findPlayer(current, userId);
    if (!claimer) return ack?.({ error: "not_in_room" });
    // Время сверяем по серверным часам: клиент рисует кнопку по своим, и они
    // могут врать.
    const allowed = canClaimHost({
      hostId: current.hostId,
      hostOfflineSince: current.hostOfflineSince,
      claimerId: userId,
      claimerOnline: claimer.player.online,
    });
    if (!allowed) return ack?.({ error: "host_is_here" });

    const snap = await mutate(roomCode, (s) => {
      s.hostId = userId;
      s.hostOfflineSince = null;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  // ─── room:transfer_host ─── (host only)
  socket.on("room:transfer_host", async (payload, ack) => {
    if (typeof payload?.userId !== "string") return ack?.({ error: "invalid_payload" });
    const target = payload.userId;
    if (target === userId) return ack?.({ error: "already_host" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (!everyoneIn(current).some((p) => p.userId === target)) {
      return ack?.({ error: "not_in_room" });
    }

    const snap = await mutate(roomCode, (s) => {
      s.hostId = target;
      const heir = findPlayer(s, target);
      s.hostOfflineSince = heir && !heir.player.online ? Date.now() : null;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    await broadcastState(ns, roomCode, snap);
  });

  socket.on("room:leave", async (_payload, ack) => {
    // Посреди партии игрок команды не выходит: очередь объясняющих завязана
    // на состав, и вынутый из списка человек ломал её — ход упирался в пустое
    // место, и партию нельзя было продолжить вообще никому. Раз выйти нельзя,
    // состав на время игры заморожен, и ломаться нечему. Хосту, чтобы
    // разойтись, есть кнопка «Завершить игру». Зрителям выход оставляем: на
    // ход они не влияют, запирать их в комнате незачем.
    const before = await load(roomCode);
    const inGame = before && before.phase !== "LOBBY" && before.phase !== "FINISHED";
    if (inGame && findPlayer(before, userId)?.location === "team") {
      return ack?.({ error: "game_in_progress" });
    }

    const snap = await mutate(roomCode, (s) => {
      removePlayer(s, userId);
      // Ушёл хост — права переходят следующему. Иначе hostId указывал бы на
      // того, кого в комнате уже нет, и начать игру не мог бы никто.
      reassignHostIfNeeded(s);
    });
    ack?.({ ok: true });
    socket.disconnect(true);
    if (!snap) return;

    // Вышел последний — держать комнату незачем: ждать в ней больше некого,
    // а код пусть освобождается сразу, не через таймер пустой комнаты.
    if (everyoneIn(snap).length === 0) {
      await remove(roomCode);
      await closeRoom(roomCode);
      return;
    }
    await broadcastState(ns, roomCode, snap);
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
      // Прав за обрыв связи не лишаем: у человека мог моргнуть Wi-Fi. Но
      // запускаем отсчёт, после которого комнату можно забрать кнопкой —
      // иначе один севший телефон подвешивает всю компанию.
      s.hostOfflineSince = nextHostOfflineSince({
        hostOnline: isHostOnline(s),
        current: s.hostOfflineSince,
      });
    });
    if (!snap) return;
    // Пропал тот, кто сейчас объясняет — ставим раунд на паузу, чтобы время
    // не горело, пока его нет.
    await pauseIfExplainerDropped(ns, roomCode, userId);
    await broadcastState(ns, roomCode, snap);
  });

  // Подавляем "unused MIN_TEAMS" (нужен для UI-валидации старта игры,
  // которая будет в следующих сессиях).
  void MIN_TEAMS;
}
