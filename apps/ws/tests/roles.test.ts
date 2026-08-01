// Раздача ролей: каждый игрок получает ровно одну роль из состава.

import { describe, it, expect } from "vitest";
import { buildRolePool, assignRoles } from "../src/games/mafia/roles";
import { player, snapshot } from "./fixtures";

function lobbyOf(n: number) {
  return snapshot(
    Array.from({ length: n }, (_, i) => ({
      ...player(`p${i}`, "civilian"),
      role: null,
      ready: true,
    })),
    { phase: "LOBBY", day: 0 },
  );
}

describe("buildRolePool", () => {
  it("длина пула равна числу игроков", () => {
    for (let n = 5; n <= 16; n++) {
      expect(buildRolePool(n, lobbyOf(n)), `пул на ${n}`).toHaveLength(n);
    }
  });
});

describe("assignRoles", () => {
  it("раздаёт роль каждому и переводит в ROLE_REVEAL", () => {
    const s = lobbyOf(9);
    assignRoles(s);
    expect(s.phase).toBe("ROLE_REVEAL");
    expect(s.players.every((p) => p.role !== null)).toBe(true);
    expect(s.players.every((p) => p.alive)).toBe(true);
    // Готовность сбрасывается — каждый должен заново подтвердить роль.
    expect(s.players.every((p) => p.ready === false)).toBe(true);
  });

  it("состав соответствует настройкам", () => {
    const s = lobbyOf(9);
    assignRoles(s);
    const count = (r: string) => s.players.filter((p) => p.role === r).length;
    expect(count("mafia") + count("don")).toBe(3);
    expect(count("don")).toBe(1);
    expect(count("sheriff")).toBe(1);
    expect(count("doctor")).toBe(1);
    expect(count("maniac")).toBe(0);
  });

  it("роли перемешиваются, а не раздаются по порядку", () => {
    // Один и тот же расклад 20 раз: хотя бы раз первый игрок обязан
    // получить разные роли, иначе раздача детерминирована.
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = lobbyOf(9);
      assignRoles(s);
      seen.add(String(s.players[0].role));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
