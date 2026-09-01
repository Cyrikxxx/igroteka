// Сезонные темы видны круглый год, но в свой месяц поднимаются наверх.
// Месяц передаётся параметром, поэтому тест не зависит от даты запуска.

import { describe, it, expect } from "vitest";
import { isInSeason, seasonRank } from "../src/season";

describe("isInSeason", () => {
  it("Новый год — декабрь и январь", () => {
    expect(isInSeason("newyear", 12)).toBe(true);
    expect(isInSeason("newyear", 1)).toBe(true);
    expect(isInSeason("newyear", 2)).toBe(false);
    expect(isInSeason("newyear", 7)).toBe(false);
  });

  it("Хэллоуин — только октябрь", () => {
    expect(isInSeason("halloween", 10)).toBe(true);
    expect(isInSeason("halloween", 9)).toBe(false);
    expect(isInSeason("halloween", 11)).toBe(false);
  });

  it("Лето — июнь, июль, август", () => {
    for (const m of [6, 7, 8]) expect(isInSeason("summer", m)).toBe(true);
    expect(isInSeason("summer", 5)).toBe(false);
    expect(isInSeason("summer", 9)).toBe(false);
  });

  it("несезонная тема не сезонна никогда", () => {
    for (let m = 1; m <= 12; m++) {
      expect(isInSeason(null, m)).toBe(false);
      expect(isInSeason(undefined, m)).toBe(false);
      expect(isInSeason("", m)).toBe(false);
    }
  });

  it("незнакомое значение не роняет и не считается сезоном", () => {
    expect(isInSeason("восьмое-марта", 3)).toBe(false);
  });
});

describe("seasonRank", () => {
  it("сезонное сейчас идёт впереди всего остального", () => {
    // Декабрь: Новый год наверх, лето и обычные темы — следом.
    const list = [
      { slug: "summer", season: "summer" },
      { slug: "party", season: null },
      { slug: "newyear", season: "newyear" },
    ];
    const sorted = [...list].sort((a, b) => seasonRank(a.season, 12) - seasonRank(b.season, 12));
    expect(sorted[0].slug).toBe("newyear");
  });

  it("вне сезона порядок не меняется — сортировка устойчива", () => {
    const list = [
      { slug: "party", season: null },
      { slug: "newyear", season: "newyear" },
      { slug: "halloween", season: "halloween" },
    ];
    const sorted = [...list].sort((a, b) => seasonRank(a.season, 5) - seasonRank(b.season, 5));
    expect(sorted.map((x) => x.slug)).toEqual(["party", "newyear", "halloween"]);
  });
});
