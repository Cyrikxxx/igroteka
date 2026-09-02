// Наследование хоста в комнате Алиаса. Раньше `room:leave` вырезал игрока,
// но не трогал hostId: если уходил хост, права не доставались никому —
// нельзя было ни собрать команду, ни поменять настройки, ни начать игру.

import { describe, it, expect } from "vitest";
import { removePlayer, reassignHostIfNeeded } from "../src/snapshot-builders";
import type { RoomSnapshot, RoomSnapshotPlayer } from "../src/domain";

function player(userId: string): RoomSnapshotPlayer {
  return { userId, displayName: userId, online: true };
}

function room(): RoomSnapshot {
  return {
    code: "ABCDEF",
    title: null,
    status: "LOBBY",
    hostId: "host",
    settings: { roundTime: 60, winScore: 50, penaltySkip: false, categoryIds: [1] },
    phase: "LOBBY",
    currentTeamId: null,
    currentPlayerId: null,
    currentRoundNumber: 1,
    teams: [
      { id: 1, name: "Лисы", color: "--team-1", score: 0, playerCursor: 0, players: [player("host"), player("anna")] },
      { id: 2, name: "Совы", color: "--team-2", score: 0, playerCursor: 0, players: [player("boris")] },
    ],
    spectators: [player("kate")],
    timer: null,
    scoreboard: null,
    gameId: null,
  };
}

describe("reassignHostIfNeeded", () => {
  it("пока хост в комнате — ничего не меняет", () => {
    const s = room();
    expect(reassignHostIfNeeded(s)).toBeNull();
    expect(s.hostId).toBe("host");
  });

  it("хост вышел — права уходят следующему игроку", () => {
    const s = room();
    removePlayer(s, "host");
    const heir = reassignHostIfNeeded(s);
    expect(heir?.userId).toBe("anna");
    expect(s.hostId).toBe("anna");
  });

  it("игроков не осталось — хостом становится зритель", () => {
    const s = room();
    for (const id of ["host", "anna", "boris"]) removePlayer(s, id);
    expect(reassignHostIfNeeded(s)?.userId).toBe("kate");
    expect(s.hostId).toBe("kate");
  });

  it("комната опустела — менять некому, hostId не трогаем", () => {
    const s = room();
    for (const id of ["host", "anna", "boris", "kate"]) removePlayer(s, id);
    expect(reassignHostIfNeeded(s)).toBeNull();
    expect(s.hostId).toBe("host");
  });

  it("вышел не хост — смены не происходит", () => {
    const s = room();
    removePlayer(s, "boris");
    expect(reassignHostIfNeeded(s)).toBeNull();
    expect(s.hostId).toBe("host");
  });

  it("наследника ищем среди тех, кто на связи", () => {
    // Раньше брался просто первый по списку, и комната доставалась игроку,
    // которого нет в сети, — то есть оставалась такой же беспомощной.
    const s = room();
    s.teams[0].players[1].online = false; // anna
    removePlayer(s, "host");
    expect(reassignHostIfNeeded(s)?.userId).toBe("boris");
    expect(s.hostId).toBe("boris");
    expect(s.hostOfflineSince).toBeNull();
  });

  it("все наследники оффлайн — права всё равно уходят, но отсчёт запускается", () => {
    const s = room();
    for (const t of s.teams) t.players.forEach((p) => (p.online = false));
    s.spectators.forEach((p) => (p.online = false));
    removePlayer(s, "host");
    expect(reassignHostIfNeeded(s)?.userId).toBe("anna");
    expect(typeof s.hostOfflineSince).toBe("number");
  });
});
