// Правила «кто в комнате главный».
//
// Ключевое различие, ради которого всё это писалось: обрыв связи и уход —
// разные события. У хоста моргнул Wi-Fi — он остаётся хостом; вышел кнопкой —
// права уходят другому. А чтобы комната не зависла на пропавшем хосте,
// остальные могут забрать её кнопкой, но не раньше чем через минуту.

import { describe, it, expect } from "vitest";
import {
  pickHeir,
  nextHostOfflineSince,
  canClaimHost,
  roomTtlSeconds,
} from "../src/host";
import {
  HOST_CLAIM_AFTER_MS,
  ROOM_TTL_SECONDS,
  EMPTY_ROOM_TTL_SECONDS,
} from "../src/constants";

const p = (userId: string, online = true) => ({ userId, online });

describe("pickHeir", () => {
  it("комната достаётся тому, кто на связи, а не первому по списку", () => {
    const heir = pickHeir([p("anna", false), p("boris", true)]);
    expect(heir?.userId).toBe("boris");
  });

  it("если на связи никого — берём первого: он станет хостом, когда вернётся", () => {
    const heir = pickHeir([p("anna", false), p("boris", false)]);
    expect(heir?.userId).toBe("anna");
  });

  it("уходящего в наследники не берём", () => {
    const heir = pickHeir([p("anna"), p("boris")], "anna");
    expect(heir?.userId).toBe("boris");
  });

  it("пустая комната — наследника нет", () => {
    expect(pickHeir([])).toBeNull();
    expect(pickHeir([p("anna")], "anna")).toBeNull();
  });
});

describe("nextHostOfflineSince", () => {
  it("хост на связи — отметки нет", () => {
    expect(nextHostOfflineSince({ hostOnline: true, current: 1000 })).toBeNull();
  });

  it("хост пропал — ставим время", () => {
    expect(nextHostOfflineSince({ hostOnline: false, current: null, now: 5000 })).toBe(5000);
  });

  it("хост всё ещё пропавший — отсчёт не сбрасывается", () => {
    // Иначе каждый чужой disconnect обнулял бы таймер и кнопка «взять
    // комнату» не появилась бы никогда.
    expect(nextHostOfflineSince({ hostOnline: false, current: 5000, now: 9000 })).toBe(5000);
  });
});

describe("canClaimHost", () => {
  const base = {
    hostId: "host",
    hostOfflineSince: 1_000,
    claimerId: "anna",
    claimerOnline: true,
  };

  it("до минуты забрать нельзя", () => {
    expect(canClaimHost({ ...base, now: 1_000 + HOST_CLAIM_AFTER_MS - 1 })).toBe(false);
  });

  it("после минуты — можно", () => {
    expect(canClaimHost({ ...base, now: 1_000 + HOST_CLAIM_AFTER_MS })).toBe(true);
  });

  it("пока хост на связи забирать нечего", () => {
    expect(canClaimHost({ ...base, hostOfflineSince: null, now: 1e9 })).toBe(false);
  });

  it("сам у себя хост комнату не забирает", () => {
    expect(canClaimHost({ ...base, claimerId: "host", now: 1e9 })).toBe(false);
  });

  it("оффлайн-игрок забрать не может", () => {
    expect(canClaimHost({ ...base, claimerOnline: false, now: 1e9 })).toBe(false);
  });
});

describe("roomTtlSeconds", () => {
  it("пока кто-то на связи — комната живёт сутки", () => {
    expect(roomTtlSeconds(true)).toBe(ROOM_TTL_SECONDS);
  });

  it("никого на связи — десять минут, а не сутки", () => {
    expect(roomTtlSeconds(false)).toBe(EMPTY_ROOM_TTL_SECONDS);
    expect(EMPTY_ROOM_TTL_SECONDS).toBeLessThan(ROOM_TTL_SECONDS);
  });
});
