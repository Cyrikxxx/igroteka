// Экран итога голосования.
//
// Ничья в первом туре и во втором — разные события: в первом она ведёт во
// второй тур, во втором заканчивает день. Экран показывал один и тот же текст
// «никто не выбывает», а игра через несколько секунд возвращала к голосованию.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SKIP_VOTE, type MafiaView } from "@alias/shared/mafia";
import { VoteResultScreen } from "@/components/mafia/DayScreens";

function view(over: Partial<MafiaView> = {}): MafiaView {
  return {
    code: "TEST01",
    title: null,
    hostId: "a",
    phase: "VOTE_RESULT",
    day: 1,
    settings: { rules: { allowSkipVote: true } },
    players: [
      { userId: "a", displayName: "Аня", avatarIdx: 0, alive: true, online: true },
      { userId: "b", displayName: "Боря", avatarIdx: 1, alive: true, online: true },
    ],
    spectatorCount: 0,
    readyCount: 0,
    aliveCount: 2,
    you: { userId: "a", role: null, team: null, alive: true, isHost: false, ready: true, isSpectator: false },
    deaths: [],
    paused: false,
    ...over,
  } as unknown as MafiaView;
}

describe("ничья в голосовании", () => {
  it("в первом туре зовёт голосовать ещё раз и называет спорных", () => {
    render(
      <VoteResultScreen
        view={view({ vote: { round: 1, tie: true, leaders: ["a", "b"], totalVoters: 2, votedCount: 2 } })}
      />,
    );
    expect(screen.getByText("Голоса разделились")).toBeTruthy();
    expect(screen.getByText(/только за Аня и Боря/)).toBeTruthy();
    expect(screen.getByText("второй тур…")).toBeTruthy();
    // Ровно то, чего тут быть не должно: день ещё не кончился.
    expect(screen.queryByText(/никто не выбывает/)).toBeNull();
  });

  it("во втором туре день кончается без изгнания", () => {
    render(
      <VoteResultScreen
        view={view({ vote: { round: 2, tie: true, leaders: ["a", "b"], totalVoters: 2, votedCount: 2 } })}
      />,
    );
    expect(screen.getByText("Голоса разделились — никто не выбывает")).toBeTruthy();
    expect(screen.getByText("ночь начнётся скоро")).toBeTruthy();
  });

  it("скип среди спорных назван словами, а не идентификатором", () => {
    render(
      <VoteResultScreen
        view={view({ vote: { round: 1, tie: true, leaders: ["a", SKIP_VOTE], totalVoters: 2, votedCount: 2 } })}
      />,
    );
    expect(screen.getByText(/Аня и никого не изгонять/)).toBeTruthy();
  });
});
