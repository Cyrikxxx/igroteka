// Создание/чтение снимка комнаты Мафии в Redis (ключ mafia:room:<code>, TTL 24ч).

import { ROOM_TTL_SECONDS } from "@alias/shared/constants";
import { mafiaRoomKey } from "@alias/shared/redis-keys";
import {
  emptyNightState,
  emptyVoteState,
  type MafiaSettings,
  type MafiaSnapshot,
  type MafiaPlayerFull,
} from "@alias/shared/mafia";
import redis from "./redis";

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
  };
}

export async function saveMafiaSnapshot(snapshot: MafiaSnapshot): Promise<void> {
  await redis.set(
    mafiaRoomKey(snapshot.code),
    JSON.stringify(snapshot),
    "EX",
    ROOM_TTL_SECONDS,
  );
}

export async function loadMafiaSnapshot(
  code: string,
): Promise<MafiaSnapshot | null> {
  const raw = await redis.get(mafiaRoomKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MafiaSnapshot;
  } catch {
    return null;
  }
}
