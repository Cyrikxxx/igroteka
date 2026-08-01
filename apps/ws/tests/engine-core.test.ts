// Разыгрывание ночи и подсчёт дневных голосов — чистая логика партии.

import { describe, it, expect } from "vitest";
import {
  resolveNight,
  decideMafiaTarget,
  tallyVotes,
  allNightActorsDone,
  allVoted,
  applyEnterNight,
} from "../src/games/mafia/engine-core";
import { player, snapshot } from "./fixtures";

describe("decideMafiaTarget", () => {
  it("берёт большинство голосов мафии", () => {
    const s = snapshot([
      player("don", "mafia"),
      player("maf", "mafia"),
      player("civ", "civilian"),
      player("civ2", "civilian"),
    ]);
    s.night.mafiaVotes = { don: "civ", maf: "civ" };
    expect(decideMafiaTarget(s)).toBe("civ");
  });

  it("голос дона решает при разногласии", () => {
    const s = snapshot([
      player("don", "don"),
      player("m1", "mafia"),
      player("m2", "mafia"),
      player("civ", "civilian"),
      player("civ2", "civilian"),
    ]);
    // Двое рядовых против одного дона — и всё равно решает дон.
    s.night.mafiaVotes = { m1: "civ2", m2: "civ2", don: "civ" };
    expect(decideMafiaTarget(s)).toBe("civ");
  });

  it("игнорирует голоса не-мафии", () => {
    const s = snapshot([player("maf", "mafia"), player("civ", "civilian")]);
    s.night.mafiaVotes = { civ: "maf" };
    expect(decideMafiaTarget(s)).toBeUndefined();
  });
});

describe("resolveNight", () => {
  it("убивает выбранную мафией жертву", () => {
    const s = snapshot([player("maf", "mafia"), player("civ", "civilian")]);
    s.night.mafiaVotes = { maf: "civ" };
    resolveNight(s);
    expect(s.players.find((p) => p.userId === "civ")?.alive).toBe(false);
    expect(s.deaths).toHaveLength(1);
    expect(s.deaths[0]).toMatchObject({ userId: "civ", by: "mafia" });
  });

  it("доктор спасает цель мафии", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("doc", "doctor"),
      player("civ", "civilian"),
    ]);
    s.night.mafiaVotes = { maf: "civ" };
    s.night.doctorTarget = "civ";
    resolveNight(s);
    expect(s.players.find((p) => p.userId === "civ")?.alive).toBe(true);
    expect(s.deaths).toHaveLength(0);
  });

  it("маньяк и мафия за одну ночь убивают двоих", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("man", "maniac"),
      player("civ", "civilian"),
      player("civ2", "civilian"),
    ]);
    s.night.mafiaVotes = { maf: "civ" };
    s.night.maniacTarget = "civ2";
    resolveNight(s);
    expect(s.deaths.map((d) => d.userId).sort()).toEqual(["civ", "civ2"]);
  });

  it("одна цель у мафии и маньяка — одна смерть, причина мафия", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("man", "maniac"),
      player("civ", "civilian"),
    ]);
    s.night.mafiaVotes = { maf: "civ" };
    s.night.maniacTarget = "civ";
    resolveNight(s);
    expect(s.deaths).toHaveLength(1);
    expect(s.deaths[0].by).toBe("mafia");
  });

  it("доктор, вылечивший себя, расходует самолечение", () => {
    const s = snapshot([player("maf", "mafia"), player("doc", "doctor")]);
    s.night.doctorTarget = "doc";
    resolveNight(s);
    expect(s.night.doctorSelfHealUsed).toBe(true);
  });
});

describe("applyEnterNight", () => {
  it("переносит память ролей в новую ночь и увеличивает день", () => {
    const s = snapshot([player("sh", "sheriff"), player("doc", "doctor")], {
      day: 2,
    });
    s.night.doctorTarget = "sh";
    s.night.doctorSelfHealUsed = true;
    s.night.sheriffResults = { doc: false };

    applyEnterNight(s);

    expect(s.day).toBe(3);
    expect(s.phase).toBe("NIGHT");
    // Прошлая цель доктора запоминается — лечить её второй раз нельзя.
    expect(s.night.doctorPrevTarget).toBe("sh");
    expect(s.night.doctorSelfHealUsed).toBe(true);
    expect(s.night.sheriffResults).toEqual({ doc: false });
    expect(s.night.doctorTarget).toBeUndefined();
  });
});

describe("tallyVotes", () => {
  it("один лидер — изгнание", () => {
    const s = snapshot([player("a", "civilian"), player("b", "civilian")]);
    s.vote.votes = { a: "b", b: "b" };
    expect(tallyVotes(s)).toEqual({ leaders: ["b"], eliminated: "b", tie: false });
  });

  it("поровну — ничья без изгнания", () => {
    const s = snapshot([player("a", "civilian"), player("b", "civilian")]);
    s.vote.votes = { a: "b", b: "a" };
    const res = tallyVotes(s);
    expect(res.tie).toBe(true);
    expect(res.eliminated).toBeUndefined();
    expect(res.leaders.sort()).toEqual(["a", "b"]);
  });

  it("воздержавшиеся не считаются", () => {
    const s = snapshot([player("a", "civilian"), player("b", "civilian")]);
    s.vote.votes = { a: "abstain", b: "a" };
    expect(tallyVotes(s).eliminated).toBe("a");
  });

  it("все воздержались — никого не изгоняют", () => {
    const s = snapshot([player("a", "civilian"), player("b", "civilian")]);
    s.vote.votes = { a: "abstain", b: "abstain" };
    const res = tallyVotes(s);
    expect(res.eliminated).toBeUndefined();
    expect(res.leaders).toEqual([]);
  });
});

describe("готовность фазы", () => {
  it("ночь не резолвится, пока не сходили все роли", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("doc", "doctor"),
      player("civ", "civilian"),
    ]);
    s.night.mafiaVotes = { maf: "civ" };
    expect(allNightActorsDone(s)).toBe(false);
    s.night.doctorTarget = "civ";
    expect(allNightActorsDone(s)).toBe(true);
  });

  it("мёртвых не ждём", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("doc", "doctor", { alive: false }),
      player("civ", "civilian"),
    ]);
    s.night.mafiaVotes = { maf: "civ" };
    expect(allNightActorsDone(s)).toBe(true);
  });

  it("голосование ждёт всех живых", () => {
    const s = snapshot([
      player("a", "civilian"),
      player("b", "civilian"),
      player("c", "civilian", { alive: false }),
    ]);
    s.vote.votes = { a: "b" };
    expect(allVoted(s)).toBe(false);
    s.vote.votes.b = "a";
    expect(allVoted(s)).toBe(true);
  });
});
