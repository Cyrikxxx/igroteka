// Полный smoke-flow: создать комнату через REST, подключиться к WS с
// токеном из ответа. Запуск: `npx tsx apps/ws/src/smoke-flow.ts`
// (при запущенном `npm run dev`).

import "../src/env";
import { io as ioClient } from "socket.io-client";

const WEB = "http://localhost:3000";
const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

/**
 * Id категорий по slug. Раньше скрипты писали categoryIds: [1, 2] — после
 * пересборки каталога id другие, и партия оставалась вовсе без слов.
 */
async function categoryIdsBySlug(...slugs: string[]): Promise<number[]> {
  const res = await fetch(`${WEB}/api/categories`);
  if (!res.ok) throw new Error(`categories: ${res.status}`);
  const catalog = (await res.json()) as {
    levels: { id: number; slug: string }[];
    collections: { categories: { id: number; slug: string }[] }[];
  };
  const all = [...catalog.levels, ...catalog.collections.flatMap((c) => c.categories)];
  return slugs.map((slug) => {
    const found = all.find((c) => c.slug === slug);
    if (!found) throw new Error(`нет категории «${slug}»`);
    return found.id;
  });
}

async function main() {
  const categoryIds = await categoryIdsBySlug("animals", "food", "jobs");
  // 1. prime cookie + create room
  const jar = new Map<string, string>();
  function readCookies(res: Response) {
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const m = sc.match(/^([^=]+)=([^;]+)/);
      if (m) jar.set(m[1], m[2]);
    }
  }
  function cookieHeader(): string {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  const r0 = await fetch(`${WEB}/api/categories`);
  readCookies(r0);

  const r1 = await fetch(`${WEB}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({
      hostName: "SmokeHost",
      title: "Smoke room",
      settings: {
        roundTime: 60,
        winScore: 50,
        penaltySkip: false,
        categoryIds,
      },
    }),
  });
  readCookies(r1);
  if (!r1.ok) throw new Error(`POST /api/rooms failed: ${r1.status}`);
  const created = (await r1.json()) as {
    room: { code: string };
    wsToken: string;
    wsUrl: string;
  };
  console.log(
    `[smoke-flow] room=${created.room.code} wsUrl=${created.wsUrl} token.len=${created.wsToken.length}`,
  );

  // 2. connect to WS with host token
  await new Promise<void>((resolve, reject) => {
    const sock = ioClient(`${WS}/room`, {
      auth: { token: created.wsToken, code: created.room.code },
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
    });
    sock.on("connect", () => {
      sock.emit("room:hello", {}, (ack: unknown) => {
        console.log("[smoke-flow] hello ack:", ack);
        sock.disconnect();
        resolve();
      });
    });
    sock.on("connect_error", (err) => {
      sock.disconnect();
      reject(new Error("WS connect_error: " + err.message));
    });
  });
  console.log("[smoke-flow] OK");
}

main().catch((e) => {
  console.error("[smoke-flow] FAIL:", e);
  process.exit(1);
});
