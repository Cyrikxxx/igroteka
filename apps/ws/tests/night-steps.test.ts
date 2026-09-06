// Шаги ночи в режиме ведущего. Главное, что здесь проверяется, — что по
// самой ночи нельзя вычислить, кто из ролей уже мёртв.

import { describe, it, expect } from "vitest";
import {
  buildNightPlan,
  nightStepDone,
  nightStepHasActor,
  nightStepActMs,
} from "../src/games/mafia/engine-core";
import { NIGHT_IDLE_MIN_MS, type MafiaSettings } from "@alias/shared/mafia";
import { player, snapshot } from "./fixtures";

const settingsWith = (
  roles: Partial<MafiaSettings["roles"]>,
): MafiaSettings["roles"] => ({
  don: true,
  sheriff: true,
  doctor: true,
  maniac: false,
  ...roles,
});

const cast = () => [
  player("maf", "mafia"),
  player("don", "don"),
  player("sh", "sheriff"),
  player("doc", "doctor"),
  player("civ", "civilian"),
];

/** Партия в режиме ведущего с нужным набором ролей. */
function game(players = cast(), roles: Partial<MafiaSettings["roles"]> = {}) {
  const base = snapshot(players);
  return snapshot(players, {
    settings: { ...base.settings, narrator: true, roles: settingsWith(roles) },
  });
}

describe("план ночи", () => {
  it("зовёт только включённые роли и всегда мафию", () => {
    const s = game(cast(), { doctor: false, maniac: false });
    expect(buildNightPlan(s.settings)).toEqual(["sleep", "mafia", "sheriff"]);
  });

  it("маньяк добавляется в конец", () => {
    const s = game(cast(), { maniac: true });
    expect(buildNightPlan(s.settings)).toEqual([
      "sleep",
      "mafia",
      "doctor",
      "sheriff",
      "maniac",
    ]);
  });

  it("не зависит от того, кто жив: мёртвого доктора всё равно зовут", () => {
    const alive = game();
    const players = cast();
    players[3].alive = false; // доктор убит
    const dead = game(players);
    expect(buildNightPlan(dead.settings)).toEqual(buildNightPlan(alive.settings));
    expect(buildNightPlan(dead.settings)).toContain("doctor");
  });
});

describe("завершён ли шаг", () => {
  it("мафия — когда проголосовали все живые мафии", () => {
    const s = game();
    s.night.mafiaVotes = { maf: "civ" };
    expect(nightStepDone(s, "mafia")).toBe(false);
    s.night.mafiaVotes.don = "civ";
    expect(nightStepDone(s, "mafia")).toBe(true);
  });

  it("одиночные роли — как только выставлена цель", () => {
    const s = game();
    expect(nightStepDone(s, "doctor")).toBe(false);
    s.night.doctorTarget = "civ";
    expect(nightStepDone(s, "doctor")).toBe(true);

    expect(nightStepDone(s, "sheriff")).toBe(false);
    s.night.sheriffTarget = "maf";
    expect(nightStepDone(s, "sheriff")).toBe(true);
  });

  it("шаг без живых носителей не считается завершённым никогда", () => {
    const players = cast();
    players[3].alive = false;
    const s = game(players);
    expect(nightStepHasActor(s, "doctor")).toBe(false);
    // Иначе пустой every() закрыл бы шаг мгновенно — ровно по этому стол и
    // понял бы, что доктора больше нет.
    expect(nightStepDone(s, "doctor")).toBe(false);
  });

  it("мафия может вымереть от маньяка — её шаг тоже не «готов»", () => {
    const players = cast();
    players[0].alive = false;
    players[1].alive = false;
    const s = game(players, { maniac: true });
    expect(nightStepDone(s, "mafia")).toBe(false);
  });
});

describe("длина окна хода", () => {
  it("живой роли — полный шаг из настроек", () => {
    const s = game();
    s.settings.timers.nightStep = 20;
    expect(nightStepActMs(s, "doctor", () => 0.5)).toBe(20000);
  });

  it("мёртвой — случайное время, но не мгновенное", () => {
    const players = cast();
    players[3].alive = false;
    const s = game(players);
    s.settings.timers.nightStep = 20;
    const shortest = nightStepActMs(s, "doctor", () => 0);
    const longest = nightStepActMs(s, "doctor", () => 1);
    expect(shortest).toBe(NIGHT_IDLE_MIN_MS);
    expect(longest).toBe(20000);
    // Разброс должен покрывать и середину: иначе «случайность» была бы
    // ровно двумя значениями.
    expect(nightStepActMs(s, "doctor", () => 0.5)).toBeGreaterThan(shortest);
    expect(nightStepActMs(s, "doctor", () => 0.5)).toBeLessThan(longest);
  });

  it("шаг короче нижней границы не ломается", () => {
    const players = cast();
    players[3].alive = false;
    const s = game(players);
    s.settings.timers.nightStep = 3;
    expect(nightStepActMs(s, "doctor", () => 0.5)).toBe(3000);
  });
});
