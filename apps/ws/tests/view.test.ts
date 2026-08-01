// Приватность персонального вида. Здесь ловится главный класс багов Мафии:
// «сервер отдал клиенту то, чего игрок знать не должен».

import { describe, it, expect } from "vitest";
import { buildView } from "../src/games/mafia/view";
import { player, snapshot } from "./fixtures";

const cast = () => [
  player("maf", "mafia"),
  player("don", "don"),
  player("sh", "sheriff"),
  player("doc", "doctor"),
  player("civ", "civilian"),
];

describe("чужие роли", () => {
  it("живой игрок видит только свою роль", () => {
    const view = buildView(snapshot(cast()), "civ");
    expect(view.you.role).toBe("civilian");
    const others = view.players.filter((p) => p.userId !== "civ");
    expect(others.every((p) => p.role === undefined)).toBe(true);
  });

  it("мафия видит напарников, но не роли города", () => {
    const view = buildView(snapshot(cast()), "maf");
    expect(view.you.partnerIds).toEqual(["don"]);
    expect(view.players.find((p) => p.userId === "sh")?.role).toBeUndefined();
  });

  it("в финале роли раскрыты всем", () => {
    const s = snapshot(cast(), { phase: "FINISHED", winner: "city" });
    const view = buildView(s, "civ");
    expect(view.players.every((p) => p.role !== undefined)).toBe(true);
  });
});

describe("роли погибших", () => {
  it("при revealRoles=false роль убитого не уходит клиенту нигде", () => {
    const players = cast();
    players[0].alive = false;
    players[0].eliminatedBy = "vote";
    players[0].deathDay = 1;
    const s = snapshot(players, {
      settings: { ...snapshot(players).settings, rules: { ...snapshot(players).settings.rules, revealRoles: false } },
      deaths: [
        { userId: "maf", displayName: "maf", role: "mafia", day: 1, by: "vote" },
      ],
    });

    const view = buildView(s, "civ");

    // Ни в списке игроков...
    expect(view.players.find((p) => p.userId === "maf")?.role).toBeUndefined();
    // ...ни в журнале смертей — именно тут роль утекала раньше.
    expect(view.deaths).toHaveLength(1);
    expect(view.deaths[0].role).toBeUndefined();
    // Сериализуем как реальный сокет: значения роли не должно быть в JSON.
    // (Подстроку "mafia" ищем именно как роль — в настройках есть mafiaCount.)
    expect(JSON.stringify(view)).not.toContain('"role":"mafia"');
  });

  it("при revealRoles=true роль убитого видна", () => {
    const players = cast();
    players[0].alive = false;
    const s = snapshot(players, {
      deaths: [
        { userId: "maf", displayName: "maf", role: "mafia", day: 1, by: "vote" },
      ],
    });
    const view = buildView(s, "civ");
    expect(view.deaths[0].role).toBe("mafia");
    expect(view.players.find((p) => p.userId === "maf")?.role).toBe("mafia");
  });
});

describe("журнал партии", () => {
  const withEvents = () =>
    snapshot(cast(), {
      events: [
        { day: 1, kind: "night_fell" },
        { day: 1, kind: "kill", displayName: "civ", role: "civilian", cause: "mafia" },
        { day: 1, kind: "check", actor: "sheriff", displayName: "maf", isMafia: true },
      ],
    });

  it("живому игроку журнал не отдаётся вовсе", () => {
    // Иначе город прочитал бы результаты проверок шерифа и роли погибших.
    const view = buildView(withEvents(), "civ");
    expect(view.events).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("check");
  });

  it("выбывший видит журнал целиком", () => {
    const players = cast();
    players[4].alive = false; // civ убит
    const s = snapshot(players, {
      events: [{ day: 1, kind: "check", actor: "sheriff", displayName: "maf", isMafia: true }],
    });
    const view = buildView(s, "civ");
    expect(view.events).toHaveLength(1);
    expect(view.events?.[0].isMafia).toBe(true);
  });

  it("в финале журнал доступен всем", () => {
    const s = snapshot(cast(), {
      phase: "FINISHED",
      winner: "city",
      events: [{ day: 2, kind: "game_over", winner: "city" }],
    });
    expect(buildView(s, "civ").events).toHaveLength(1);
  });
});

describe("ночные секреты", () => {
  it("результаты проверок шерифа уходят только шерифу", () => {
    const s = snapshot(cast());
    s.night.sheriffResults = { maf: true };
    expect(buildView(s, "sh").you.sheriffResults).toEqual({ maf: true });
    expect(buildView(s, "civ").you.sheriffResults).toBeUndefined();
  });

  it("голоса мафии видны мафии и не видны городу", () => {
    const s = snapshot(cast());
    s.night.mafiaVotes = { maf: "civ" };
    expect(buildView(s, "maf").you.mafiaVotes).toEqual({ maf: "civ" });
    expect(buildView(s, "civ").you.mafiaVotes).toBeUndefined();
    expect(JSON.stringify(buildView(s, "civ"))).not.toContain("mafiaVotes");
  });

  it("при закрытом голосовании счётчик не уходит живым", () => {
    const players = cast();
    const base = snapshot(players);
    const s = snapshot(players, {
      phase: "VOTE",
      settings: { ...base.settings, rules: { ...base.settings.rules, openVotes: false } },
    });
    s.vote.votes = { maf: "civ", don: "civ" };
    expect(buildView(s, "civ").vote?.tally).toBeUndefined();
    // Но количество проголосовавших знать можно — это не секрет.
    expect(buildView(s, "civ").vote?.votedCount).toBe(2);
  });
});
