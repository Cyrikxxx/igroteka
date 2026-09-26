// Границы настроек партии.
//
// Одни и те же числа нужны форме и серверу: разойдись они — введённое число
// молча заменялось бы на другое, и человек не понял бы, почему в партии не то,
// что он выбрал. Здесь проверяется, что кламп ведёт себя предсказуемо и что
// пресеты в форме вообще проходят серверную проверку.

import { describe, it, expect } from "vitest";
import {
  ROUND_TIME_OPTIONS,
  ROUND_TIME_LIMITS,
  ROUND_TIME_DEFAULT,
  WIN_SCORE_OPTIONS,
  WIN_SCORE_LIMITS,
  WIN_SCORE_DEFAULT,
  clampRoundTime,
  clampWinScore,
} from "../src/constants";

describe("длительность раунда", () => {
  it("значение внутри диапазона не трогается", () => {
    expect(clampRoundTime(75)).toBe(75);
  });

  it("за границами прижимается к ним", () => {
    expect(clampRoundTime(9999)).toBe(ROUND_TIME_LIMITS.max);
    expect(clampRoundTime(1)).toBe(ROUND_TIME_LIMITS.min);
  });

  it("границы допустимы сами по себе", () => {
    expect(clampRoundTime(ROUND_TIME_LIMITS.min)).toBe(ROUND_TIME_LIMITS.min);
    expect(clampRoundTime(ROUND_TIME_LIMITS.max)).toBe(ROUND_TIME_LIMITS.max);
  });

  it("дробное округляется", () => {
    expect(clampRoundTime(60.4)).toBe(60);
    expect(clampRoundTime(60.6)).toBe(61);
  });

  it("мусор превращается в значение по умолчанию", () => {
    // Пустое поле ввода даёт NaN — партия не должна начинаться с нулём секунд.
    expect(clampRoundTime(Number.NaN)).toBe(ROUND_TIME_DEFAULT);
    expect(clampRoundTime(Number.POSITIVE_INFINITY)).toBe(ROUND_TIME_DEFAULT);
  });

  it("все пресеты формы проходят серверную проверку", () => {
    for (const v of ROUND_TIME_OPTIONS) {
      expect(v).toBeGreaterThanOrEqual(ROUND_TIME_LIMITS.min);
      expect(v).toBeLessThanOrEqual(ROUND_TIME_LIMITS.max);
    }
    expect(clampRoundTime(ROUND_TIME_DEFAULT)).toBe(ROUND_TIME_DEFAULT);
  });
});

describe("счёт до победы", () => {
  it("прижимается к границам и переживает мусор", () => {
    expect(clampWinScore(99999)).toBe(WIN_SCORE_LIMITS.max);
    expect(clampWinScore(-5)).toBe(WIN_SCORE_LIMITS.min);
    expect(clampWinScore(Number.NaN)).toBe(WIN_SCORE_DEFAULT);
  });

  it("все пресеты формы проходят серверную проверку", () => {
    for (const v of WIN_SCORE_OPTIONS) {
      expect(v).toBeGreaterThanOrEqual(WIN_SCORE_LIMITS.min);
      expect(v).toBeLessThanOrEqual(WIN_SCORE_LIMITS.max);
    }
  });
});
