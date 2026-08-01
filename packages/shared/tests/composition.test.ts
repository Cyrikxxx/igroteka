// Раскладка ролей по числу игроков. От неё зависит баланс всей партии.

import { describe, it, expect } from "vitest";
import {
  computeComposition,
  DEFAULT_MAFIA_SETTINGS,
  MIN_MAFIA_PLAYERS,
  MAX_MAFIA_PLAYERS,
  type MafiaSettings,
} from "../src/mafia";

const settings = (over: Partial<MafiaSettings> = {}): MafiaSettings => ({
  ...DEFAULT_MAFIA_SETTINGS,
  ...over,
});

describe("computeComposition", () => {
  it("авто-состав: мафий примерно треть стола", () => {
    expect(computeComposition(9, settings()).mafia + computeComposition(9, settings()).don).toBe(3);
    expect(computeComposition(7, settings()).mafia + computeComposition(7, settings()).don).toBe(2);
  });

  it("сумма ролей всегда равна числу игроков", () => {
    for (let n = MIN_MAFIA_PLAYERS; n <= MAX_MAFIA_PLAYERS; n++) {
      const c = computeComposition(n, settings());
      const sum = c.mafia + c.don + c.sheriff + c.doctor + c.maniac + c.civilian;
      expect(sum, `состав на ${n} игроков`).toBe(n);
    }
  });

  it("хотя бы один мирный остаётся при любом раскладе", () => {
    for (let n = MIN_MAFIA_PLAYERS; n <= MAX_MAFIA_PLAYERS; n++) {
      const c = computeComposition(n, settings({ roles: { don: true, sheriff: true, doctor: true, maniac: true } }));
      expect(c.civilian, `мирные на ${n} игроков`).toBeGreaterThanOrEqual(1);
    }
  });

  it("дон появляется только когда мафий двое и больше", () => {
    expect(computeComposition(5, settings({ mafiaCount: 1 })).don).toBe(0);
    expect(computeComposition(9, settings({ mafiaCount: 3 })).don).toBe(1);
  });

  it("выключенные спец-роли не занимают мест", () => {
    const c = computeComposition(
      8,
      settings({ roles: { don: false, sheriff: false, doctor: false, maniac: false } }),
    );
    expect(c.sheriff + c.doctor + c.maniac + c.don).toBe(0);
    expect(c.mafia + c.civilian).toBe(8);
  });

  it("ручное число мафий не съедает весь стол", () => {
    // Просим заведомо слишком много — состав обязан остаться играбельным.
    const c = computeComposition(6, settings({ mafiaCount: 99 }));
    expect(c.civilian).toBeGreaterThanOrEqual(1);
    expect(c.mafia + c.don + c.sheriff + c.doctor + c.maniac + c.civilian).toBe(6);
  });

  it("мафий всегда хотя бы одна", () => {
    const c = computeComposition(5, settings({ mafiaCount: 0 }));
    expect(c.mafia + c.don).toBeGreaterThanOrEqual(1);
  });
});
