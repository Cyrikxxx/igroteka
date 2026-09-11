// Кнопки на карточках истории.
//
// Онлайн-партию видят все участники, поэтому «убрать» есть у каждого — и у
// гостя тоже. А у идущей партии её быть не должно: из идущей выходят, а не
// прячут её.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { resetNavigation } from "./stubs/next-navigation";
import HistoryPage from "@/app/history/page";

/** Минимальная партия Алиаса в том виде, в каком её отдаёт /api/games. */
function aliasGame(over: Record<string, unknown> = {}) {
  return {
    id: "g1",
    mode: "ONLINE",
    format: "TEAMS",
    status: "FINISHED",
    ownerKey: "someone-else",
    mine: false,
    roomId: "r1",
    room: { code: "ABC123" },
    currentRoundNumber: 2,
    trioTurn: 0,
    roundTime: 60,
    winScore: 50,
    penaltySkip: false,
    currentTeamIndex: 0,
    usedWordIds: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    finishedAt: "2026-09-01T00:10:00.000Z",
    gameCategories: [],
    teams: [
      {
        id: 1,
        name: "Лисы",
        color: "--team-1",
        score: 13,
        order: 0,
        currentPlayerIndex: 0,
        gameId: "g1",
        players: [{ id: 11, teamId: 1, userId: null, name: "Аня", order: 0 }],
      },
    ],
    ...over,
  };
}

function mafiaGame(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    status: "done",
    winner: "MAFIA",
    players: 8,
    dayCount: 3,
    endedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    settings: {},
    roster: [
      { name: "Аня", role: "mafia", alive: true },
      { name: "Боря", role: "civilian", alive: false },
    ],
    ...over,
  };
}

function stubApi(games: unknown[], mafia: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/api/games" ? games : url === "/api/mafia/history" ? mafia : null;
      return { ok: true, json: async () => body } as Response;
    }),
  );
}

async function renderHistory() {
  await act(async () => {
    render(<HistoryPage />);
  });
}

beforeEach(() => {
  resetNavigation();
  localStorage.clear();
});

describe("карточки истории", () => {
  it("у чужой доигранной онлайн-партии кнопка «убрать» есть", async () => {
    stubApi([aliasGame()], []);
    await renderHistory();
    expect(screen.getAllByLabelText("Убрать из истории")).toHaveLength(1);
  });

  it("у идущей онлайн-партии её нет — из партии выходят, а не прячут", async () => {
    stubApi([aliasGame({ status: "IN_PROGRESS" })], []);
    await renderHistory();
    expect(screen.queryByLabelText("Убрать из истории")).toBeNull();
    expect(screen.getByText("Продолжить")).toBeTruthy();
  });

  it("на карточке видны игроки, а не название команды", async () => {
    stubApi([aliasGame()], []);
    await renderHistory();
    expect(screen.getByText("Аня")).toBeTruthy();
    // Команда осталась подписью справа, но строка теперь про игрока.
    expect(screen.getByText("Лисы")).toBeTruthy();
  });

  it("доигранная партия Мафии ведёт на свои итоги, а не на историю", async () => {
    stubApi([], [mafiaGame()]);
    await renderHistory();
    const link = screen.getByText("Итоги").closest("a");
    expect(link?.getAttribute("href")).toBe("/mafia/results/m1");
    expect(screen.getAllByLabelText("Убрать из истории")).toHaveLength(1);
  });

  it("у идущей партии Мафии убрать нельзя", async () => {
    stubApi([], [mafiaGame({ status: "live", code: "XYZ999", winner: null, phase: "Ночь 2" })]);
    await renderHistory();
    expect(screen.queryByLabelText("Убрать из истории")).toBeNull();
  });
});

describe("список истории", () => {
  it("обе игры идут одним списком по дате, а не Алиас впереди Мафии", async () => {
    // Раньше сначала шёл весь Алиас, потом вся Мафия — и вчерашняя партия
    // Алиаса стояла выше сегодняшней Мафии.
    stubApi(
      [aliasGame({ id: "a-old", finishedAt: "2026-09-01T00:00:00.000Z" })],
      [mafiaGame({ id: "m-new", endedAt: "2026-09-05T00:00:00.000Z" })],
    );
    await renderHistory();
    const cards = [...document.querySelectorAll(".hist-card")];
    expect(cards).toHaveLength(2);
    const kinds = cards.map((c) => (c.textContent?.includes("Мафия") ? "mafia" : "alias"));
    expect(kinds).toEqual(["mafia", "alias"]);
  });

  it("в карточке Мафии виден состав", async () => {
    stubApi([], [mafiaGame()]);
    await renderHistory();
    expect(screen.getByText("Аня")).toBeTruthy();
    expect(screen.getByText("Боря")).toBeTruthy();
  });
});
