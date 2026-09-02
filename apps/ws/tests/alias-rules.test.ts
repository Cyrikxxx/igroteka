// Чистые правила Алиаса: очки за раунд, победа и переход хода.

import { describe, it, expect } from "vitest";
import { scoreRound, checkWinner } from "../src/games/alias/services/score";
import { nextTurn, nextPlayerIndex } from "../src/games/alias/services/turn";

describe("scoreRound", () => {
  it("без штрафа считает только угаданные", () => {
    expect(scoreRound({ guessed: 5, skipped: 3, penaltySkip: false, currentTeamScore: 10 }))
      .toEqual({ scoreEarned: 5, newTeamScore: 15 });
  });

  it("со штрафом вычитает пропуски", () => {
    expect(scoreRound({ guessed: 5, skipped: 3, penaltySkip: true, currentTeamScore: 10 }))
      .toEqual({ scoreEarned: 2, newTeamScore: 12 });
  });

  it("счёт команды не уходит в минус", () => {
    const r = scoreRound({ guessed: 0, skipped: 4, penaltySkip: true, currentTeamScore: 1 });
    expect(r.scoreEarned).toBe(-4);
    expect(r.newTeamScore).toBe(0);
  });
});

describe("checkWinner", () => {
  const teams = [
    { id: 1, score: 52 },
    { id: 2, score: 48 },
  ];

  it("победа засчитывается только в конце круга команд", () => {
    expect(checkWinner({ teams, winScore: 50, circleDone: false }).gameFinished).toBe(false);
    expect(checkWinner({ teams, winScore: 50, circleDone: true })).toEqual({
      gameFinished: true,
      winnerTeamId: 1,
    });
  });

  it("при нескольких дошедших до цели выигрывает набравший больше", () => {
    const res = checkWinner({
      teams: [
        { id: 1, score: 55 },
        { id: 2, score: 61 },
      ],
      winScore: 50,
      circleDone: true,
    });
    expect(res.winnerTeamId).toBe(2);
  });

  it("никто не дошёл — игра продолжается", () => {
    expect(
      checkWinner({ teams: [{ id: 1, score: 10 }], winScore: 50, circleDone: true }).gameFinished,
    ).toBe(false);
  });

  it("winScore=0 отключает победу по очкам", () => {
    expect(checkWinner({ teams, winScore: 0, circleDone: true }).gameFinished).toBe(false);
  });
});

describe("nextTurn", () => {
  it("ход идёт по кругу, номер раунда растёт на новом круге", () => {
    expect(nextTurn({ currentTeamIndex: 0, currentRoundNumber: 1, teamsCount: 2 }))
      .toEqual({ nextTeamIndex: 1, nextRoundNumber: 1 });
    expect(nextTurn({ currentTeamIndex: 1, currentRoundNumber: 1, teamsCount: 2 }))
      .toEqual({ nextTeamIndex: 0, nextRoundNumber: 2 });
  });

  it("объясняющий внутри команды тоже меняется по кругу", () => {
    expect(nextPlayerIndex(0, 3)).toBe(1);
    expect(nextPlayerIndex(2, 3)).toBe(0);
  });

  it("пустая команда не ломает индекс", () => {
    expect(nextPlayerIndex(0, 0)).toBe(0);
  });
});
