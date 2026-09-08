// Подпись куки `aid`.
//
// Кука — единственное доказательство личности: по ней отдаётся история партий
// и право удалять свои игры. Однажды значения этих кук уехали в публичный
// репозиторий дампом базы, и тогда знание чужого id означало чужой аккаунт.
// Тест держит дверь закрытой.

import { describe, it, expect, beforeAll } from "vitest";

const SECRET = "тест-секрет-для-подписи-куки-aid-достаточной-длины";

let issueAid: typeof import("../src/lib/aid-cookie")["issueAid"];
let verifyAid: typeof import("../src/lib/aid-cookie")["verifyAid"];

beforeAll(async () => {
  process.env.WS_TOKEN_SECRET = SECRET;
  ({ issueAid, verifyAid } = await import("../src/lib/aid-cookie"));
});

describe("кука aid", () => {
  it("своя подпись принимается, а userId возвращается тем же", async () => {
    const { userId, cookie } = await issueAid();
    expect(cookie.startsWith(`${userId}.`)).toBe(true);
    expect(await verifyAid(cookie)).toBe(userId);
  });

  it("два устройства получают разные личности", async () => {
    const a = await issueAid();
    const b = await issueAid();
    expect(a.userId).not.toBe(b.userId);
  });

  it("старая кука без подписи не принимается — как раз такие и утекли", async () => {
    expect(await verifyAid("891910cd-0de0-4b44-bc78-382eab93e4d4")).toBeNull();
  });

  it("чужой id со своей подписью не подставить", async () => {
    const { cookie } = await issueAid();
    const signature = cookie.slice(cookie.indexOf(".") + 1);
    const forged = `891910cd-0de0-4b44-bc78-382eab93e4d4.${signature}`;
    expect(await verifyAid(forged)).toBeNull();
  });

  it("испорченная подпись не принимается", async () => {
    const { userId, cookie } = await issueAid();
    expect(await verifyAid(cookie.slice(0, -1))).toBeNull();
    expect(await verifyAid(`${userId}.`)).toBeNull();
    expect(await verifyAid(`.${userId}`)).toBeNull();
  });

  it("пустая кука — это отсутствие личности, а не ошибка", async () => {
    expect(await verifyAid(undefined)).toBeNull();
    expect(await verifyAid("")).toBeNull();
  });
});
