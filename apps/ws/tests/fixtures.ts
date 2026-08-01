// Конструкторы снапшота Мафии для тестов: собрать партию с нужным
// раскладом ролей одной строкой.

import {
  DEFAULT_MAFIA_SETTINGS,
  emptyNightState,
  emptyVoteState,
  type MafiaPlayerFull,
  type MafiaRole,
  type MafiaSettings,
  type MafiaSnapshot,
} from "@alias/shared/mafia";

/** Игрок: id совпадает с именем — так тесты читаются глазами. */
export function player(
  id: string,
  role: MafiaRole,
  overrides: Partial<MafiaPlayerFull> = {},
): MafiaPlayerFull {
  return {
    userId: id,
    displayName: id,
    avatarIdx: 0,
    order: 0,
    online: true,
    alive: true,
    isHost: false,
    ready: true,
    role,
    ...overrides,
  };
}

export function snapshot(
  players: MafiaPlayerFull[],
  overrides: Partial<MafiaSnapshot> = {},
): MafiaSnapshot {
  const settings: MafiaSettings = {
    ...DEFAULT_MAFIA_SETTINGS,
    ...(overrides.settings ?? {}),
  };
  return {
    code: "TEST01",
    title: null,
    hostId: players[0]?.userId ?? "host",
    createdAt: Date.now(),
    phase: "NIGHT",
    day: 1,
    players: players.map((p, i) => ({ ...p, order: i })),
    spectators: [],
    night: emptyNightState(),
    vote: emptyVoteState(),
    deaths: [],
    events: [],
    ...overrides,
    settings,
  };
}
