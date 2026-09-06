// Реплики ведущего. Здесь ловится главный риск озвучки: сказать вслух то,
// что столу знать не положено.

import { describe, it, expect } from "vitest";
import {
  DEFAULT_MAFIA_SETTINGS,
  emptyNightState,
  emptyVoteState,
  type MafiaSnapshot,
  type MafiaPlayerFull,
  type MafiaRole,
} from "../src/mafia";
import { narrationFor, humanDuration } from "../src/mafia-narration";

function p(id: string, role: MafiaRole, alive = true): MafiaPlayerFull {
  return {
    userId: id,
    displayName: id,
    avatarIdx: 0,
    order: 0,
    online: true,
    alive,
    isHost: false,
    ready: true,
    role,
  };
}

function snap(overrides: Partial<MafiaSnapshot> = {}): MafiaSnapshot {
  return {
    code: "TEST01",
    title: null,
    hostId: "Максим",
    createdAt: 0,
    phase: "NIGHT",
    day: 1,
    settings: {
      ...DEFAULT_MAFIA_SETTINGS,
      narrator: true,
      roles: { ...DEFAULT_MAFIA_SETTINGS.roles },
      timers: { ...DEFAULT_MAFIA_SETTINGS.timers },
      rules: { ...DEFAULT_MAFIA_SETTINGS.rules },
    },
    players: [p("Максим", "sheriff"), p("Аня", "mafia"), p("Игорь", "civilian")],
    spectators: [],
    night: emptyNightState(),
    vote: emptyVoteState(),
    deaths: [],
    events: [],
    ...overrides,
  };
}

describe("когда ведущий молчит", () => {
  it("без режима ведущего реплик нет вовсе", () => {
    const s = snap();
    s.settings.narrator = false;
    s.night.step = { role: "mafia", stage: "announce", index: 1, actMs: 20000 };
    expect(narrationFor(s)).toBeUndefined();
  });

  it("в окне хода и в тишине после него — тоже", () => {
    const s = snap();
    s.night.step = { role: "mafia", stage: "act", index: 1, actMs: 20000 };
    expect(narrationFor(s)).toBeUndefined();
    s.night.step = { role: "mafia", stage: "gap", index: 1, actMs: 20000 };
    expect(narrationFor(s)).toBeUndefined();
  });
});

describe("ночь", () => {
  it("зовёт роль по имени шага", () => {
    const s = snap();
    s.night.step = { role: "doctor", stage: "announce", index: 2, actMs: 20000 };
    expect(narrationFor(s)?.text).toContain("Просыпается доктор");
  });

  it("фразы «роль засыпает» нет ни у одного шага", () => {
    const s = snap();
    for (const role of ["sleep", "mafia", "doctor", "sheriff", "maniac"] as const) {
      s.night.step = { role, stage: "announce", index: 0, actMs: 0 };
      expect(narrationFor(s)?.text).not.toContain("засыпает доктор");
      expect(narrationFor(s)?.text).not.toContain("Доктор засыпает");
    }
  });

  it("ключ меняется от шага к шагу, а внутри шага — нет", () => {
    const s = snap();
    s.night.step = { role: "mafia", stage: "announce", index: 1, actMs: 20000 };
    const first = narrationFor(s)?.key;
    const again = narrationFor(s)?.key;
    s.night.step = { role: "doctor", stage: "announce", index: 2, actMs: 20000 };
    const second = narrationFor(s)?.key;
    expect(first).toBe(again);
    expect(second).not.toBe(first);
  });

  it("после паузы счётчик повторов делает ключ новым — роль позовут заново", () => {
    const s = snap();
    s.night.step = { role: "mafia", stage: "announce", index: 1, actMs: 20000 };
    const before = narrationFor(s)?.key;
    s.narrationEpoch = 1;
    expect(narrationFor(s)?.key).not.toBe(before);
    expect(narrationFor(s)?.text).toBe(
      "Просыпается мафия. Мафия, выберите жертву.",
    );
  });
});

describe("утро", () => {
  const withDeath = (revealRoles: boolean) => {
    const s = snap({ phase: "MORNING" });
    s.settings.rules.revealRoles = revealRoles;
    s.deaths = [
      { userId: "Максим", displayName: "Максим", role: "sheriff", day: 1, by: "mafia" },
    ];
    return s;
  };

  it("роль погибшего звучит только при revealRoles", () => {
    expect(narrationFor(withDeath(true))?.text).toContain("Максим — шериф");
    const hidden = narrationFor(withDeath(false))?.text ?? "";
    expect(hidden).toContain("погибает Максим");
    expect(hidden).not.toContain("шериф");
  });

  it("двое за ночь — оба названы", () => {
    const s = withDeath(false);
    s.deaths.push({
      userId: "Игорь",
      displayName: "Игорь",
      role: "civilian",
      day: 1,
      by: "maniac",
    });
    expect(narrationFor(s)?.text).toContain("погибают Максим и Игорь");
  });

  it("прошлые смерти не приплетаются к этой ночи", () => {
    const s = withDeath(false);
    s.day = 2;
    expect(narrationFor(s)?.text).toContain("все выжили");
  });
});

describe("день", () => {
  it("голосование объявляется, а во втором круге — с кандидатами", () => {
    const s = snap({ phase: "VOTE" });
    expect(narrationFor(s)?.text).toContain("Начинается голосование");
    s.vote = { round: 2, votes: {}, leaders: ["Максим", "Аня"] };
    expect(narrationFor(s)?.text).toContain("Максим, Аня");
  });

  it("итог голосования называет выбывшего", () => {
    const s = snap({ phase: "VOTE_RESULT" });
    s.vote = { round: 1, votes: {}, eliminated: "Аня" };
    expect(narrationFor(s)?.text).toContain("выбывает Аня");
  });

  it("ничья — никого не называем", () => {
    const s = snap({ phase: "VOTE_RESULT" });
    s.vote = { round: 1, votes: {}, tie: true, leaders: ["Максим", "Аня"] };
    expect(narrationFor(s)?.text).toBe("Голоса разделились.");
  });

  it("последнее слово — по имени", () => {
    const s = snap({ phase: "LAST_WORD", pendingElim: "Игорь" });
    expect(narrationFor(s)?.text).toBe("Последнее слово, Игорь.");
  });

  it("финал называет победителя", () => {
    const s = snap({ phase: "FINISHED", winner: "maniac" });
    expect(narrationFor(s)?.text).toContain("Побеждает маньяк");
  });
});

describe("humanDuration", () => {
  it("минуты и секунды склоняются", () => {
    expect(humanDuration(60)).toBe("одна минута");
    expect(humanDuration(120)).toBe("две минуты");
    expect(humanDuration(300)).toBe("5 минут");
    expect(humanDuration(45)).toBe("45 секунд");
    expect(humanDuration(21)).toBe("21 секунда");
  });
});
