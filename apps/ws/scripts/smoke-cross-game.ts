// Код чужой игры во входе.
//
// Вход Алиаса не смотрел на платформу комнаты. Мафийный код доходил до него,
// снимок искался по ключу `room:<код>` — а снимки Мафии лежат в
// `mafia:room:<код>`, — комната считалась брошенной и закрывалась: живую
// партию выкидывало разом у всех, кто попробует перезайти. Хватало одного
// человека, набравшего код не в той форме.
//
// Сюда же и обратный случай: код Алиаса во входе Мафии. Там проверка была
// всегда, но пусть держится тестом, а не обещанием.
//
// Запуск: `npm run smoke:cross-game -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

/** Отдельная «вкладка»: своя кука `aid`, то есть свой человек. */
function tab() {
  const jar = new Map<string, string>();
  const read = (res: Response) => {
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const m = sc.match(/^([^=]+)=([^;]+)/);
      if (m) jar.set(m[1], m[2]);
    }
  };
  const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  return {
    async prime() {
      read(await fetch(`${WEB}/api/categories`));
    },
    async get(path: string) {
      const res = await fetch(`${WEB}${path}`, { headers: { cookie: cookie() } });
      read(res);
      return res;
    },
    async post(path: string, body: unknown) {
      const res = await fetch(`${WEB}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookie() },
        body: JSON.stringify(body),
      });
      read(res);
      return res;
    },
  };
}

async function categoryIds(): Promise<string[]> {
  const res = await fetch(`${WEB}/api/categories`);
  const data = (await res.json()) as {
    collections: { categories: { id: string }[] }[];
  };
  const first = data.collections[0]?.categories[0]?.id;
  if (!first) throw new Error("каталог категорий пуст");
  return [first];
}

async function main(): Promise<void> {
  const mafiaHost = tab();
  const aliasHost = tab();
  const stranger = tab();
  for (const t of [mafiaHost, aliasHost, stranger]) await t.prime();

  // ─── Комната Мафии ───
  const mRes = await mafiaHost.post("/api/mafia/rooms", {
    hostName: "Хост",
    title: "Smoke перекрёстный вход",
  });
  if (!mRes.ok) throw new Error(`create mafia: ${mRes.status} ${await mRes.text()}`);
  const mafiaCode = ((await mRes.json()) as { room: { code: string } }).room.code;
  console.log(`[create] мафия=${mafiaCode}`);

  // Чужой человек набирает мафийный код в форме Алиаса.
  const wrongDoor = await stranger.post(`/api/rooms/${mafiaCode}/join`, {
    displayName: "Прохожий",
  });
  assert(wrongDoor.status === 404, `вход Алиаса не знает мафийного кода (${wrongDoor.status})`);

  // И — главное — комната от этого не умерла.
  const stillThere = await stranger.get(`/api/rooms/resolve?code=${mafiaCode}`);
  assert(stillThere.ok, `комната Мафии жива (resolve ${stillThere.status})`);
  const platform = ((await stillThere.json()) as { platform: string }).platform;
  assert(platform === "MAFIA", `и по-прежнему мафийная (${platform})`);

  const rightDoor = await stranger.post(`/api/mafia/rooms/${mafiaCode}/join`, {
    displayName: "Прохожий",
  });
  assert(rightDoor.ok, `в неё по-прежнему пускают через свой вход (${rightDoor.status})`);

  // ─── Комната Алиаса ───
  const aRes = await aliasHost.post("/api/rooms", {
    hostName: "Хост",
    title: "Smoke перекрёстный вход",
    settings: { roundTime: 30, winScore: 10, penaltySkip: false, categoryIds: await categoryIds() },
  });
  if (!aRes.ok) throw new Error(`create alias: ${aRes.status} ${await aRes.text()}`);
  const aliasCode = ((await aRes.json()) as { room: { code: string } }).room.code;
  console.log(`[create] алиас=${aliasCode}`);

  const wrongDoor2 = await stranger.post(`/api/mafia/rooms/${aliasCode}/join`, {
    displayName: "Прохожий",
  });
  assert(wrongDoor2.status === 404, `вход Мафии не знает кода Алиаса (${wrongDoor2.status})`);

  const aliveA = await stranger.get(`/api/rooms/resolve?code=${aliasCode}`);
  assert(aliveA.ok, `комната Алиаса жива (resolve ${aliveA.status})`);

  const rightDoor2 = await stranger.post(`/api/rooms/${aliasCode}/join`, {
    displayName: "Прохожий",
  });
  assert(rightDoor2.ok, `в неё пускают через свой вход (${rightDoor2.status})`);

  console.log("[smoke-cross-game] все проверки зелёные");
  process.exit(0);
}

main().catch((e) => {
  console.error("[smoke-cross-game] FAIL:", e);
  process.exit(1);
});
