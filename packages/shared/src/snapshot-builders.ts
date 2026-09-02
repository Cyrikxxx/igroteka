// Чистые функции построения / трансформации RoomSnapshot.
// Не зависят от Redis — каждая сторона (apps/web, apps/ws) использует
// эти билдеры и сама записывает результат в свой ioredis-клиент.

import type { GameFormat, RoomSnapshot, RoomSnapshotPlayer } from "./domain";
import {
  teamColorVar,
  DEFAULT_TEAM_NAMES,
  MAX_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
  TRIO_PLAYERS_PER_TEAM,
} from "./constants";
import { pickHeir, roomTtlSeconds } from "./host";

export function buildLobbySnapshot(args: {
  code: string;
  title: string | null;
  hostId: string;
  hostDisplayName: string;
  settings: RoomSnapshot["settings"];
}): RoomSnapshot {
  return {
    code: args.code,
    title: args.title,
    status: "LOBBY",
    hostId: args.hostId,
    settings: args.settings,
    phase: "LOBBY",
    currentTeamId: null,
    currentPlayerId: null,
    currentRoundNumber: 0,
    teams: [],
    spectators: [
      {
        userId: args.hostId,
        displayName: args.hostDisplayName,
        online: false,
        order: 0,
      },
    ],
    timer: null,
    scoreboard: null,
    gameId: null,
  };
}

/**
 * Сколько жить ключу комнаты в Redis. Пустая комната держалась сутки: код
 * занят, а зайти в неё некуда. Теперь такая живёт минуты, а вернувшийся
 * человек сам продлевает срок обратно — TTL пересчитывается на каждой записи.
 */
export function roomSnapshotTtl(snapshot: RoomSnapshot): number {
  return roomTtlSeconds(everyoneIn(snapshot).some((p) => p.online));
}

/** Сколько человек влезает в одну команду при этом формате. */
export function teamCapacity(format: GameFormat | undefined): number {
  return format === "TRIO" ? TRIO_PLAYERS_PER_TEAM : MAX_PLAYERS_PER_TEAM;
}

/**
 * Переключение формата комнаты. Втроём вместо команд — три места
 * вместимостью в одного человека: так вход в команду, кик и переподключение
 * работают ровно как раньше, меняются только вместимость и то, что мест
 * всегда три и добавить свои нельзя.
 *
 * Состав при переключении уезжает в зрители: место и команда — разные вещи,
 * и «перенести» человека из одной в другую было бы гаданием. Обратный
 * переход оставляет комнату без команд — как у только что созданной.
 */
export function applyRoomFormat(snapshot: RoomSnapshot, format: GameFormat): void {
  snapshot.format = format;
  for (const team of snapshot.teams) {
    for (const p of team.players) {
      snapshot.spectators.push({ ...p, order: snapshot.spectators.length });
    }
  }
  snapshot.teams =
    format === "TRIO"
      ? Array.from({ length: TRIO_TEAMS }, (_, i) => ({
          id: i + 1,
          name: `Место ${i + 1}`,
          color: teamColorVar(i),
          score: 0,
          players: [],
          playerCursor: 0,
        }))
      : [];
}

/** Находит игрока в любой команде или в spectators. Возвращает null, если нет. */
export function findPlayer(
  snapshot: RoomSnapshot,
  userId: string,
): { player: RoomSnapshotPlayer; location: "team"; teamId: number } | {
  player: RoomSnapshotPlayer;
  location: "spectator";
} | null {
  for (const team of snapshot.teams) {
    const p = team.players.find((x) => x.userId === userId);
    if (p) return { player: p, location: "team", teamId: team.id };
  }
  const spec = snapshot.spectators.find((s) => s.userId === userId);
  if (spec) return { player: spec, location: "spectator" };
  return null;
}

/** Удаляет игрока отовсюду; возвращает удалённую запись (или null). */
export function removePlayer(
  snapshot: RoomSnapshot,
  userId: string,
): RoomSnapshotPlayer | null {
  for (const team of snapshot.teams) {
    const idx = team.players.findIndex((p) => p.userId === userId);
    if (idx >= 0) {
      const [p] = team.players.splice(idx, 1);
      return p;
    }
  }
  const idx = snapshot.spectators.findIndex((s) => s.userId === userId);
  if (idx >= 0) {
    const [p] = snapshot.spectators.splice(idx, 1);
    return p;
  }
  return null;
}

/**
 * Вернуть всех, кто сейчас в комнате: игроки команд плюс зрители,
 * в порядке «сначала игроки».
 */
export function everyoneIn(snapshot: RoomSnapshot): RoomSnapshotPlayer[] {
  return [...snapshot.teams.flatMap((t) => t.players), ...snapshot.spectators];
}

/**
 * Если хоста больше нет в комнате — отдать права первому оставшемуся.
 *
 * Без этого `room:leave` оставлял `hostId` указывать на ушедшего, и права
 * не доставались никому: нельзя было ни собрать команду, ни поменять
 * настройки, ни начать игру — комната становилась мёртвой. В Мафии
 * наследник назначался всегда, в Алиасе — нет.
 *
 * Возвращает нового хоста, если смена произошла.
 */
export function reassignHostIfNeeded(
  snapshot: RoomSnapshot,
): RoomSnapshotPlayer | null {
  const present = everyoneIn(snapshot);
  if (present.some((p) => p.userId === snapshot.hostId)) return null;
  // Наследника выбирает общее правило: сначала тот, кто на связи. Раньше тут
  // брался просто первый по списку, и комната могла достаться оффлайн-игроку.
  const heir = pickHeir(present);
  if (!heir) return null;
  snapshot.hostId = heir.userId;
  snapshot.hostOfflineSince = heir.online ? null : Date.now();
  return heir;
}

/** Следующий локальный id команды (в лобби Team-row в Postgres ещё нет). */
export function nextTeamId(snapshot: RoomSnapshot): number {
  let max = 0;
  for (const t of snapshot.teams) if (t.id > max) max = t.id;
  return max + 1;
}

/** Дефолтный цвет команды по её индексу. */
export { teamColorVar };

/**
 * Подбирает первый свободный цвет из палитры `TEAM_COLOR_VARS`,
 * чтобы при удалении команды в середине последовательности новые
 * команды не получали уже занятый цвет.
 */
export function nextUnusedTeamColor(snapshot: RoomSnapshot): string {
  const used = new Set(snapshot.teams.map((t) => t.color));
  // Импортируем TEAM_COLOR_VARS лениво, чтобы не плодить циркулярные ссылки.
  const palette: readonly string[] = [
    "--team-1",
    "--team-2",
    "--team-3",
    "--team-4",
    "--team-5",
    "--team-6",
  ];
  for (const c of palette) {
    if (!used.has(c)) return c;
  }
  // Все цвета заняты (=MAX_TEAMS=6 команд уже). Возвращаем первый — на
  // практике сюда не попадаем, потому что MAX_TEAMS проверяется выше.
  return palette[0];
}

/**
 * Подбирает свободное название для новой команды. Парная к
 * `nextUnusedTeamColor`: раньше имя бралось по числу команд
 * (`DEFAULT_TEAM_NAMES[teams.length]`), поэтому после удаления команды из
 * середины списка следующая получала уже занятое имя — было видно как
 * «Барсы, Орлы, Тигры, Волки, Барсы, Орлы».
 *
 * Сначала пробуем словарь `DEFAULT_TEAM_NAMES`, затем «Команда N» с первым
 * свободным N. Сравнение без учёта регистра и пробелов по краям, чтобы
 * переименованная вручную «барсы» тоже считалась занятой.
 */
export function nextUnusedTeamName(usedNames: Iterable<string>): string {
  const used = new Set<string>();
  for (const n of usedNames) used.add(n.trim().toLowerCase());

  for (const name of DEFAULT_TEAM_NAMES) {
    if (!used.has(name.toLowerCase())) return name;
  }
  for (let i = 1; ; i++) {
    const name = `Команда ${i}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}
