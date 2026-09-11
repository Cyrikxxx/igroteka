// События лобби Мафии. Хост: settings/rename/kick/start. Любой: hello/leave/ready.
// Все участники лобби лежат в snap.players (команд нет — у каждого будет роль).

import {
  MIN_MAFIA_PLAYERS,
  MAX_MAFIA_PLAYERS,
  normalizeMafiaSettings,
  type MafiaPlayerFull,
  type MafiaSnapshot,
  type MafiaWinner,
} from "@alias/shared/mafia";
import { pickHeir, nextHostOfflineSince, canClaimHost } from "@alias/shared/host";
import { mutate, load } from "../snapshot";
import { assignRoles } from "../roles";
import {
  enterDiscussion,
  enterNight,
  ensurePhaseTimer,
  finishGame,
  maybeResolveNightEarly,
  maybeTallyEarly,
  maybeEndDiscussionEarly,
  restartToLobby,
  closeRoom,
  pauseIfRoomEmpty,
  resumeIfPausedByEmpty,
} from "../engine";
import { eliminateLeaver } from "../engine-core";
import { checkWinner } from "../services/win";

/**
 * hostId и флаг isHost у игрока — две записи об одном и том же, и клиент
 * читает вторую. Двигаем их только вместе, иначе комната остаётся без
 * кнопок хоста при формально назначенном хосте.
 */
function setHost(s: MafiaSnapshot, userId: string): void {
  s.hostId = userId;
  // Флаг снимаем и ставим в обоих списках: хостом может быть и зритель —
  // например, ему передали комнату. Пока флаг жил только у players, такой
  // хост оставался без прав, а комната считалась брошенной.
  s.players.forEach((p) => (p.isHost = p.userId === userId));
  s.spectators.forEach((p) => (p.isHost = p.userId === userId));
  const host = findInRoom(s, userId);
  s.hostOfflineSince = host && !host.online ? Date.now() : null;
}

/** Участник комнаты, кем бы он ни был — игроком или зрителем. */
function findInRoom(s: MafiaSnapshot, userId: string): MafiaPlayerFull | undefined {
  return (
    s.players.find((p) => p.userId === userId) ??
    s.spectators.find((p) => p.userId === userId)
  );
}

/**
 * Все ли посмотрели свою роль. Ушедших не ждём: `mafia:leave` помечает их
 * погибшими, но из списка не убирает, и раньше один закрывший вкладку на
 * раздаче ролей подвешивал партию навсегда — ночь наступала только когда
 * «готов» нажали вообще все.
 */
function everyoneSawRole(s: MafiaSnapshot): boolean {
  const waitingFor = s.players.filter((p) => p.alive);
  return waitingFor.length > 0 && waitingFor.every((p) => p.ready);
}

/** Хост на связи? Отсюда берётся отсчёт «комната зависла». */
function isHostOnline(s: MafiaSnapshot): boolean {
  return findInRoom(s, s.hostId)?.online ?? false;
}

/**
 * Хост ушёл САМ — комната достаётся тому, кто на связи. Обрыв связи сюда не
 * ведёт: у человека мог моргнуть Wi-Fi, и отбирать за это комнату нечестно.
 *
 * Игроки идут первыми, зрители — следом. Раньше зрителей в наследники не
 * брали вовсе, и комната, где остались одни зрители, зависала навсегда:
 * наследника нет, а забрать её кнопкой было некому.
 */
function transferHostIfNeeded(s: MafiaSnapshot, leavingUserId: string): void {
  if (s.hostId !== leavingUserId) return;
  const heir = pickHeir([...s.players, ...s.spectators], leavingUserId);
  if (!heir) return;
  setHost(s, heir.userId);
}
import { buildView } from "../view";
import {
  scheduleStateBroadcast,
  broadcastStateNow,
  mafiaRoom,
} from "../broadcast";
import type { MafiaSocket, MafiaNamespace } from "../io-types";

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
      if (before.banned?.some((b) => b.userId === userId)) return ack?.({ error: "kicked" });
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
      if (!s.players.some((p) => p.userId === s.hostId)) {
        const heir = pickHeir(s.players);
        if (heir) setHost(s, heir.userId);
        return;
      }
      // Хост вернулся — отсчёт «комната зависла» снимаем, кнопка «взять
      // комнату на себя» у остальных должна пропасть.
      s.hostOfflineSince = nextHostOfflineSince({
        hostOnline: isHostOnline(s),
        current: s.hostOfflineSince,
      });
    });
    if (!snap) {
      ack?.({ error: "room_not_found" });
      return;
    }
    // ack отдаёт персональный view сразу; остальным — через mafia:state.
    ack?.(buildView(withHost ?? snap, userId));
    await broadcastStateNow(ns, roomCode);
    // Вернулись в брошенную партию — снимаем паузу, поставленную из-за
    // пустой комнаты, и продолжаем с того же остатка.
    await resumeIfPausedByEmpty(ns, roomCode);
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
    // Присланное сливается с текущими настройками и клампится общей функцией:
    // она же чинит комнаты, созданные до появления новых полей.
    const snap = await mutate(roomCode, (s) => {
      s.settings = normalizeMafiaSettings(payload, s.settings);
    });
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

  // ─── mafia:set_name ─── любой, только LOBBY
  // Имя задаётся один раз при входе и потом нигде не редактировалось: чтобы
  // исправить опечатку, приходилось пересоздавать комнату.
  socket.on("mafia:set_name", async (payload, ack) => {
    if (typeof payload?.displayName !== "string") {
      return ack?.({ error: "invalid_payload" });
    }
    const name = payload.displayName.trim().slice(0, 50);
    if (!name) return ack?.({ error: "invalid_payload" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    // В идущей партии переименование запутало бы всех: по именам голосуют.
    if (current.phase !== "LOBBY") return ack?.({ error: "game_in_progress" });

    const snap = await mutate(roomCode, (s) => {
      const entry =
        s.players.find((p) => p.userId === userId) ??
        s.spectators.find((p) => p.userId === userId);
      if (entry) entry.displayName = name;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:unban ─── host
  socket.on("mafia:unban", async (payload, ack) => {
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
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:claim_host ─── любой игрок, когда хост давно не в сети
  // Обрыв связи хоста прав не отнимает — иначе комната слетала бы от любого
  // моргнувшего Wi-Fi. Но и ждать пропавшего вечно нельзя: без хоста нельзя
  // ни начать игру, ни поменять настройки. Поэтому забрать комнату может сам
  // участник — руками и не раньше чем через минуту.
  socket.on("mafia:claim_host", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    // Зрители тоже могут: иначе комната, где все выбыли или подсели после
    // старта, оставалась бы без хозяина до самой уборки.
    const claimer = findInRoom(current, userId);
    if (!claimer) return ack?.({ error: "not_in_room" });
    // Время сверяем по серверным часам: клиент рисует кнопку по своим.
    const allowed = canClaimHost({
      hostId: current.hostId,
      hostOfflineSince: current.hostOfflineSince,
      claimerId: userId,
      claimerOnline: claimer.online,
    });
    if (!allowed) return ack?.({ error: "host_is_here" });

    const snap = await mutate(roomCode, (s) => setHost(s, userId));
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    scheduleStateBroadcast(ns, roomCode);
  });

  // ─── mafia:transfer_host ─── host
  // До этого хост менялся только сам, когда прежний уходил из комнаты.
  socket.on("mafia:transfer_host", async (payload, ack) => {
    if (typeof payload?.userId !== "string") return ack?.({ error: "invalid_payload" });
    const target = payload.userId;
    if (target === userId) return ack?.({ error: "already_host" });
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    const inRoom = [...current.players, ...current.spectators].some(
      (p) => p.userId === target,
    );
    if (!inRoom) return ack?.({ error: "not_in_room" });

    const snap = await mutate(roomCode, (s) => setHost(s, target));
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
      const gone =
        s.players.find((p) => p.userId === target) ??
        s.spectators.find((p) => p.userId === target);
      s.players = s.players.filter((p) => p.userId !== target);
      s.spectators = s.spectators.filter((p) => p.userId !== target);
      s.players.forEach((p, i) => (p.order = i));
      // Помним, кого выгнали: иначе он просто переподключится тем же токеном.
      // Имя нужно, чтобы хост видел, кого возвращает через mafia:unban.
      if (gone) {
        s.banned = [...(s.banned ?? []), { userId: target, displayName: gone.displayName }];
      }
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
      } else {
        eliminateLeaver(s, userId);
      }

      transferHostIfNeeded(s, userId);
      // Только в идущей партии: в лобби роли ещё не розданы, и checkWinner
      // принял бы «нет живой мафии» за победу города.
      if (inGame) winner = checkWinner(s);
    });

    ack?.({ ok: true });
    socket.disconnect(true);
    if (!snap) return;

    // Вышел последний — держать комнату незачем: ждать в ней больше некого,
    // а код пусть освобождается сразу, не через таймер пустой комнаты.
    if (snap.players.length === 0 && snap.spectators.length === 0) {
      await closeRoom(ns, roomCode);
      return;
    }

    if (winner) {
      await finishGame(ns, roomCode, winner);
      return;
    }
    scheduleStateBroadcast(ns, roomCode);
    // Ушедший мог быть последним, кого ждала фаза. Раздача ролей тоже ждёт:
    // без этой проверки уход последнего «не готового» никто бы не заметил.
    if (snap.phase === "ROLE_REVEAL" && everyoneSawRole(snap)) {
      await enterNight(ns, roomCode);
      return;
    }
    await maybeResolveNightEarly(ns, roomCode);
    await maybeTallyEarly(ns, roomCode);
    // Обсуждение ждёт согласия всех живых — ушедший мог быть последним, чьего
    // нажатия не хватало.
    await maybeEndDiscussionEarly(ns, roomCode);
  });

  // ─── mafia:close ─── host, в любой момент
  socket.on("mafia:close", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });

    ack?.({ ok: true });
    await closeRoom(ns, roomCode, userId);
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

  // ─── mafia:start_night ─── host, только на раздаче ролей
  // Рычаг на случай, когда кто-то закрыл вкладку, не нажав «готов»: без него
  // партия ждала бы его возвращения вечно.
  socket.on("mafia:start_night", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase !== "ROLE_REVEAL") return ack?.({ error: "wrong_phase" });
    ack?.({ ok: true });
    await enterNight(ns, roomCode);
  });

  // ─── mafia:end_game ─── host, во время партии
  // Оборвать партию и вернуть всех в лобби, не закрывая комнату: состав
  // пересобирается и играют заново. Раньше у хоста было только «закрыть
  // комнату» — то есть насовсем.
  socket.on("mafia:end_game", async (_payload, ack) => {
    const current = await load(roomCode);
    if (!current) return ack?.({ error: "room_not_found" });
    if (current.hostId !== userId) return ack?.({ error: "forbidden" });
    if (current.phase === "LOBBY") return ack?.({ error: "not_in_game" });
    const ok = await restartToLobby(ns, roomCode);
    ack?.(ok ? { ok: true } : { error: "cant_end" });
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
      if (s.phase === "ROLE_REVEAL" && everyoneSawRole(s)) allReady = true;
    });
    if (!snap) return ack?.({ error: "room_not_found" });
    ack?.({ ok: true });
    // Все готовы → вступительное обсуждение, и только потом первая ночь:
    // компании нужно поговорить до того, как кто-то начнёт погибать.
    if (allReady) await enterDiscussion(ns, roomCode);
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
      // Комнату у пропавшего хоста НЕ отбираем — раньше это делалось прямо
      // здесь, и хост слетал от любого моргнувшего Wi-Fi. Вместо этого
      // запускаем отсчёт: через минуту остальные смогут забрать её кнопкой.
      s.hostOfflineSince = nextHostOfflineSince({
        hostOnline: isHostOnline(s),
        current: s.hostOfflineSince,
      });
    });
    if (snap) scheduleStateBroadcast(ns, roomCode);
    // Ушёл последний — партию останавливаем, чтобы она не доигрывала сама
    // себя в пустой комнате.
    await pauseIfRoomEmpty(ns, roomCode);
  });
}
