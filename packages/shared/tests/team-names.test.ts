// Подбор названия для новой команды. Раньше имя бралось по числу команд,
// поэтому после удаления команды из середины следующая получала уже занятое.

import { describe, it, expect } from "vitest";
import { nextUnusedTeamName } from "../src/snapshot-builders";
import { DEFAULT_TEAM_NAMES, MAX_TEAMS } from "../src/constants";

describe("nextUnusedTeamName", () => {
  it("на пустом столе берёт первое имя из словаря", () => {
    expect(nextUnusedTeamName([])).toBe(DEFAULT_TEAM_NAMES[0]);
  });

  it("идёт по словарю по порядку, пока имена свободны", () => {
    const teams: string[] = [];
    for (let i = 0; i < DEFAULT_TEAM_NAMES.length; i++) {
      const next = nextUnusedTeamName(teams);
      expect(next).toBe(DEFAULT_TEAM_NAMES[i]);
      teams.push(next);
    }
  });

  it("сценарий из отчёта: 6 команд, удалили первые 4, добавили ещё 4", () => {
    // Раньше это давало «Барсы, Орлы, Тигры, Волки, Барсы, Орлы».
    let teams = [...DEFAULT_TEAM_NAMES.slice(0, MAX_TEAMS)];
    teams = teams.slice(4);
    for (let i = 0; i < 4; i++) teams.push(nextUnusedTeamName(teams));

    expect(new Set(teams).size).toBe(teams.length);
    expect(teams).toHaveLength(MAX_TEAMS);
  });

  it("занятой считает и переименованную вручную команду, без учёта регистра", () => {
    const next = nextUnusedTeamName(["  лИсЫ ", DEFAULT_TEAM_NAMES[1]]);
    expect(next).toBe(DEFAULT_TEAM_NAMES[2]);
  });

  it("когда словарь исчерпан, продолжает «Командой N» и не повторяется", () => {
    const teams = [...DEFAULT_TEAM_NAMES];
    const a = nextUnusedTeamName(teams);
    expect(a).toBe("Команда 1");
    teams.push(a);
    expect(nextUnusedTeamName(teams)).toBe("Команда 2");
  });

  it("не выдаёт «Команду N», если такое имя уже занято вручную", () => {
    const teams = [...DEFAULT_TEAM_NAMES, "Команда 1", "команда 2"];
    expect(nextUnusedTeamName(teams)).toBe("Команда 3");
  });
});
