// Чистые функции построения / трансформации RoomSnapshot.
// Не зависят от Redis — каждая сторона (apps/web, apps/ws) использует
// эти билдеры и сама записывает результат в свой ioredis-клиент.

import type { RoomSnapshot, RoomSnapshotPlayer } from "./domain";
import { teamColorVar } from "./constants";

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

/** Меняет онлайн-флаг игрока (где бы он ни находился). */
export function setOnline(
  snapshot: RoomSnapshot,
  userId: string,
  online: boolean,
): boolean {
  for (const team of snapshot.teams) {
    for (const p of team.players) {
      if (p.userId === userId) {
        p.online = online;
        return true;
      }
    }
  }
  for (const s of snapshot.spectators) {
    if (s.userId === userId) {
      s.online = online;
      return true;
    }
  }
  return false;
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
