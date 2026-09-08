// Восстановление раунда локальной игры после перезагрузки вкладки.
//
// Раньше страница всегда просила у сервера новую пачку слов и заводила полный
// таймер, поэтому обновление страницы посреди раунда стирало все ответы.
// Здесь проверяется, что при живом черновике слова берутся из него, а новых
// сервер не отдаёт.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { resetNavigation, setRouteParams } from "./stubs/next-navigation";
import LocalRoundPage from "@/app/alias/local/[id]/round/page";
import { saveRound } from "@/lib/local-round";

const GAME_ID = "g1";

/** Локальная партия в том виде, в каком её отдаёт /api/games/[id]. */
function game() {
  return {
    id: GAME_ID,
    mode: "LOCAL",
    format: "TEAMS",
    status: "IN_PROGRESS",
    roundTime: 60,
    winScore: 50,
    penaltySkip: false,
    currentTeamIndex: 0,
    trioTurn: 0,
    currentRoundNumber: 1,
    usedWordIds: [],
    gameCategories: [],
    teams: [
      {
        id: 1,
        name: "Лисы",
        color: "--team-1",
        score: 0,
        order: 0,
        currentPlayerIndex: 0,
        gameId: GAME_ID,
        players: [{ id: 11, teamId: 1, userId: null, name: "Аня", order: 0 }],
      },
      {
        id: 2,
        name: "Совы",
        color: "--team-2",
        score: 0,
        order: 1,
        currentPlayerIndex: 0,
        gameId: GAME_ID,
        players: [{ id: 12, teamId: 2, userId: null, name: "Боря", order: 0 }],
      },
    ],
  };
}

/** Считает, просили ли у сервера новые слова. */
let wordsRequested = 0;

function stubApi() {
  wordsRequested = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/words")) {
        wordsRequested += 1;
        return {
          ok: true,
          json: async () => [
            { id: 90, text: "свежее-слово-1" },
            { id: 91, text: "свежее-слово-2" },
          ],
        } as Response;
      }
      return { ok: true, json: async () => game() } as Response;
    }),
  );
}

async function renderRound() {
  await act(async () => {
    render(<LocalRoundPage />);
  });
}

beforeEach(() => {
  resetNavigation();
  setRouteParams({ id: GAME_ID });
  localStorage.clear();
  stubApi();
});

describe("раунд после перезагрузки вкладки", () => {
  it("без черновика берёт свежие слова у сервера", async () => {
    await renderRound();
    expect(wordsRequested).toBe(1);
    expect(screen.getByText("свежее-слово-1")).toBeTruthy();
  });

  it("с черновиком продолжает свои слова и новых не просит", async () => {
    saveRound(GAME_ID, {
      words: [
        { wordId: 1, text: "маяк", guessed: true, order: 0 },
        { wordId: 2, text: "жираф", guessed: false, order: 1 },
        { wordId: 3, text: "недосказанное", guessed: null, order: 2 },
      ],
      currentIndex: 2,
      phase: "active",
      countdown: { endsAt: Date.now() + 30_000, remainingMs: 30_000 },
    });

    await renderRound();

    expect(wordsRequested).toBe(0);
    // Продолжаем с того слова, на котором остановились.
    expect(screen.getByText("недосказанное")).toBeTruthy();
    expect(screen.queryByText("свежее-слово-1")).toBeNull();
  });

  it("истёкший за время простоя раунд открывается сразу итогами", async () => {
    saveRound(GAME_ID, {
      words: [
        { wordId: 1, text: "маяк", guessed: true, order: 0 },
        { wordId: 2, text: "жираф", guessed: false, order: 1 },
      ],
      currentIndex: 2,
      phase: "active",
      countdown: { endsAt: Date.now() - 1000, remainingMs: 0 },
    });

    await renderRound();

    expect(wordsRequested).toBe(0);
    expect(screen.getByText(/итог раунда/i)).toBeTruthy();
  });

  it("черновик с уже открытыми итогами так и открывается", async () => {
    saveRound(GAME_ID, {
      words: [{ wordId: 1, text: "маяк", guessed: true, order: 0 }],
      currentIndex: 1,
      phase: "summary",
      countdown: { endsAt: null, remainingMs: 12_000 },
    });

    await renderRound();

    expect(wordsRequested).toBe(0);
    expect(screen.getByText(/итог раунда/i)).toBeTruthy();
  });
});
