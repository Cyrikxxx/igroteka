// Чистые построители снапшота Мафии (без Redis и без Prisma).
// Симметрично snapshot-builders.ts, где живут построители Алиаса.

import {
  emptyNightState,
  emptyVoteState,
  type MafiaSettings,
  type MafiaSnapshot,
  type MafiaPlayerFull,
} from "./mafia";
import { roomTtlSeconds } from "./host";

/**
 * Сколько жить ключу комнаты в Redis. Пустая комната держалась сутки: код
 * занят, а зайти в неё некуда. Теперь такая живёт минуты, а вернувшийся
 * человек сам продлевает срок обратно — TTL пересчитывается на каждой записи.
 */
export function mafiaSnapshotTtl(snapshot: MafiaSnapshot): number {
  return roomTtlSeconds(
    [...snapshot.players, ...snapshot.spectators].some((p) => p.online),
  );
}

/** Стартовый снапшот только что созданной комнаты: в ней один хост. */
export function buildMafiaLobbySnapshot(args: {
  code: string;
  title: string | null;
  hostId: string;
  hostDisplayName: string;
  settings: MafiaSettings;
}): MafiaSnapshot {
  const host: MafiaPlayerFull = {
    userId: args.hostId,
    displayName: args.hostDisplayName,
    avatarIdx: 0,
    order: 0,
    // Хост станет online, когда откроет сокет и пришлёт mafia:hello.
    online: false,
    alive: true,
    isHost: true,
    ready: false,
    role: null,
  };
  return {
    code: args.code,
    title: args.title,
    hostId: args.hostId,
    createdAt: Date.now(),
    phase: "LOBBY",
    day: 0,
    settings: args.settings,
    players: [host],
    spectators: [],
    night: emptyNightState(),
    vote: emptyVoteState(),
    deaths: [],
    events: [],
  };
}
