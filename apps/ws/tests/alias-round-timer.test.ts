// Время раунда Алиаса.
//
// Живое время лежит только в Redis, в RoundState, и считается этими двумя
// функциями. До сих пор они не были покрыты вообще — а именно на них держится
// и остаток на кольце, и момент, когда раунд пора добивать.

import { describe, it, expect } from "vitest";
import { msLeft, timerView, type RoundState } from "../src/games/alias/services/roundState";

const T0 = 1_000_000;

function state(over: Partial<RoundState> = {}): RoundState {
  return {
    teamId: 1,
    explainerUserId: "u1",
    playerName: "Аня",
    roundNumber: 1,
    durationMs: 60_000,
    startedAt: T0,
    pausedAt: null,
    pausedTotalMs: 0,
    wordsSeen: [],
    currentWordId: null,
    currentWordText: null,
    currentWordOrder: 0,
    ...over,
  };
}

describe("остаток раунда", () => {
  it("убывает по мере хода времени", () => {
    expect(msLeft(state(), T0)).toBe(60_000);
    expect(msLeft(state(), T0 + 10_000)).toBe(50_000);
  });

  it("не уходит в минус после истечения", () => {
    expect(msLeft(state(), T0 + 90_000)).toBe(0);
  });

  it("прошлые паузы не съедают время", () => {
    // Десять секунд простояли — значит и остаток на десять секунд больше.
    expect(msLeft(state({ pausedTotalMs: 10_000 }), T0 + 30_000)).toBe(40_000);
  });

  it("на текущей паузе остаток замирает", () => {
    const s = state({ pausedAt: T0 + 20_000 });
    expect(msLeft(s, T0 + 20_000)).toBe(40_000);
    expect(msLeft(s, T0 + 50_000)).toBe(40_000);
  });
});

describe("таймер для снимка", () => {
  it("идущий раунд отдаёт дедлайн, согласованный с остатком", () => {
    const v = timerView(state(), T0 + 15_000);
    expect(v.paused).toBe(false);
    expect(v.msLeft).toBe(45_000);
    // Дедлайн и остаток обязаны сходиться: сервер перевзводит таймер по нему.
    expect(v.endsAt! - (T0 + 15_000)).toBe(v.msLeft);
    expect(v.durationMs).toBe(60_000);
  });

  it("на паузе дедлайна нет", () => {
    const v = timerView(state({ pausedAt: T0 + 20_000 }), T0 + 50_000);
    expect(v.paused).toBe(true);
    expect(v.endsAt).toBeNull();
    expect(v.msLeft).toBe(40_000);
  });
});
