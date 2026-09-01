// Круг игры втроём. Главное, что тут проверяется: за круг каждый должен
// рассказать каждому и поугадывать у каждого — то есть все шесть
// упорядоченных пар обязаны встретиться ровно по разу.

import { describe, it, expect } from "vitest";
import { TRIO_TURNS, trioRoles, nextTrioTurn, scoredTeamIndexes } from "../src/trio";

/** Все ходы круга подряд, начиная с нулевого. */
const CIRCLE = Array.from({ length: TRIO_TURNS }, (_, t) => trioRoles(t));

describe("круг из шести ходов", () => {
  it("все шесть пар «кто кому» встречаются ровно по разу", () => {
    const pairs = CIRCLE.map((r) => `${r.explainer}->${r.guesser}`);
    expect(new Set(pairs).size).toBe(TRIO_TURNS);
    expect([...pairs].sort()).toEqual(
      ["0->1", "0->2", "1->0", "1->2", "2->0", "2->1"],
    );
  });

  it("каждый дважды объясняет — и обоим соседям", () => {
    for (const p of [0, 1, 2]) {
      const listeners = CIRCLE.filter((r) => r.explainer === p).map((r) => r.guesser);
      expect(listeners).toHaveLength(2);
      expect([...listeners].sort()).toEqual([0, 1, 2].filter((x) => x !== p));
    }
  });

  it("каждый дважды угадывает — и у обоих соседей", () => {
    for (const p of [0, 1, 2]) {
      const speakers = CIRCLE.filter((r) => r.guesser === p).map((r) => r.explainer);
      expect(speakers).toHaveLength(2);
      expect([...speakers].sort()).toEqual([0, 1, 2].filter((x) => x !== p));
    }
  });

  it("каждый дважды отдыхает", () => {
    for (const p of [0, 1, 2]) {
      expect(CIRCLE.filter((r) => r.resting === p)).toHaveLength(2);
    }
  });

  it("на каждом ходу трое заняты разными ролями", () => {
    for (const r of CIRCLE) {
      expect(new Set([r.explainer, r.guesser, r.resting]).size).toBe(3);
    }
  });

  it("первые три хода — пары 1-2, 2-3, 3-1, как договорились", () => {
    expect(CIRCLE.slice(0, 3).map((r) => [r.explainer, r.guesser])).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
  });

  it("вторая половина круга — те же пары с обменом ролями", () => {
    for (let t = 0; t < 3; t++) {
      expect(CIRCLE[t + 3].explainer).toBe(CIRCLE[t].guesser);
      expect(CIRCLE[t + 3].guesser).toBe(CIRCLE[t].explainer);
    }
  });
});

describe("nextTrioTurn", () => {
  it("счётчик возвращается к нулю ровно один раз за круг", () => {
    const seq = [];
    let t = 0;
    for (let i = 0; i < TRIO_TURNS; i++) {
      t = nextTrioTurn(t);
      seq.push(t);
    }
    expect(seq).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it("кривое значение из базы не роняет партию", () => {
    expect(nextTrioTurn(TRIO_TURNS)).toBe(1);
    expect(nextTrioTurn(-1)).toBe(0);
    expect(trioRoles(-1)).toEqual(trioRoles(TRIO_TURNS - 1));
  });
});

describe("scoredTeamIndexes", () => {
  it("в обычном режиме очки идут одной команде", () => {
    expect(scoredTeamIndexes("TEAMS", 0, 3)).toEqual([3]);
    // Номер хода в обычном режиме ни на что не влияет.
    expect(scoredTeamIndexes("TEAMS", 4, 1)).toEqual([1]);
  });

  it("втроём очки идут обоим игрокам пары, отдыхающему — нет", () => {
    for (let t = 0; t < TRIO_TURNS; t++) {
      const { explainer, guesser, resting } = trioRoles(t);
      const scored = scoredTeamIndexes("TRIO", t, explainer);
      expect(scored).toEqual([explainer, guesser]);
      expect(scored).not.toContain(resting);
    }
  });

  it("за круг каждый получает очки ровно за четыре хода из шести", () => {
    const times = [0, 0, 0];
    for (let t = 0; t < TRIO_TURNS; t++) {
      for (const i of scoredTeamIndexes("TRIO", t, trioRoles(t).explainer)) times[i]++;
    }
    expect(times).toEqual([4, 4, 4]);
  });
});
