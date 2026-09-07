// Строки карточки истории: кто играл, за какую команду и с каким счётом.
//
// Названия команд в списке ни о чём не говорят, поэтому строка — на игрока.
// Здесь проверяется, что при этом ничего не теряется: ни счёт, ни команда без
// состава, ни партия втроём, где команда и игрок — одно лицо.

import { describe, it, expect } from "vitest";
import { historyLines } from "../src/lib/history-rows";
import type { GameFromAPI, TeamFromAPI } from "@alias/shared/domain";

function team(
  id: number,
  name: string,
  score: number,
  playerNames: string[],
): TeamFromAPI {
  return {
    id,
    name,
    color: `--team-${id}`,
    score,
    order: id,
    currentPlayerIndex: 0,
    gameId: "g1",
    players: playerNames.map((n, i) => ({
      id: id * 100 + i,
      teamId: id,
      userId: null,
      name: n,
      order: i,
    })),
  } as TeamFromAPI;
}

const game = (teams: TeamFromAPI[]) => ({ teams }) as GameFromAPI;

describe("historyLines", () => {
  it("строка на игрока, счёт у соседей по команде общий", () => {
    const lines = historyLines(
      game([team(1, "Лисы", 22, ["Аня", "Игорь"]), team(2, "Совы", 2, ["Лена"])]),
    );
    expect(lines.map((l) => l.name)).toEqual(["Аня", "Игорь", "Лена"]);
    expect(lines.map((l) => l.score)).toEqual([22, 22, 2]);
    expect(lines.map((l) => l.team)).toEqual(["Лисы", "Лисы", "Совы"]);
  });

  it("цвет берётся у команды, а не по порядку строки", () => {
    const lines = historyLines(game([team(3, "Лисы", 0, ["Аня", "Игорь"])]));
    expect(lines.every((l) => l.color === "--team-3")).toBe(true);
  });

  it("втроём команда и есть игрок — второй раз имя не пишем", () => {
    const lines = historyLines(
      game([team(1, "Аня", 10, ["Аня"]), team(2, "Игорь", 7, ["Игорь"])]),
    );
    expect(lines.map((l) => l.team)).toEqual([null, null]);
    expect(lines.map((l) => l.name)).toEqual(["Аня", "Игорь"]);
  });

  it("команда без состава остаётся строкой — карточка не пустеет", () => {
    // Так выглядит брошенная онлайн-партия: игроки попадают в Postgres только
    // в момент старта.
    const lines = historyLines(game([team(1, "Лисы", 0, []), team(2, "Совы", 0, [])]));
    expect(lines.map((l) => l.name)).toEqual(["Лисы", "Совы"]);
    expect(lines.every((l) => l.team === null)).toBe(true);
  });

  it("порядок команд и игроков сохраняется", () => {
    const lines = historyLines(
      game([team(1, "Лисы", 5, ["Аня", "Игорь", "Лена"]), team(2, "Совы", 3, ["Пётр"])]),
    );
    expect(lines.map((l) => l.name)).toEqual(["Аня", "Игорь", "Лена", "Пётр"]);
    expect(lines.map((l) => l.key)).toEqual([
      "player-100",
      "player-101",
      "player-102",
      "player-200",
    ]);
  });
});
