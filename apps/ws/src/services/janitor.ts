// Уборка брошенных комнат.
//
// Снимок в Redis живёт сутки и исчезает сам, а строка Room в Postgres —
// нет: комната, которую бросили недоигранной, навсегда остаётся в статусе
// LOBBY или IN_GAME. Со временем это и мусор в базе, и занятые коды.
//
// Раз в час закрываем всё, что не подавало признаков жизни дольше суток.
// Живой комнате это не грозит: пока в ней играют, снимок в Redis
// обновляется, а вместе с ним продлевается и TTL.

import { prisma } from "../prisma";
import { redis } from "../redis";
import { roomKey, mafiaRoomKey } from "@alias/shared/redis-keys";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** Столько же, сколько живёт снимок комнаты в Redis. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

async function hasLiveSnapshot(code: string, platform: string): Promise<boolean> {
  const key = platform === "MAFIA" ? mafiaRoomKey(code) : roomKey(code);
  return (await redis.exists(key)) === 1;
}

/** Возвращает число закрытых комнат — удобно для логов и тестов. */
export async function sweepAbandonedRooms(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - STALE_AFTER_MS);

  const candidates = await prisma.room.findMany({
    where: {
      status: { in: ["LOBBY", "IN_GAME"] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, code: true, platform: true },
    take: 500,
  });
  if (candidates.length === 0) return 0;

  // Снимок в Redis — признак того, что комнату ещё могут доиграть.
  const dead: string[] = [];
  for (const room of candidates) {
    if (await hasLiveSnapshot(room.code, room.platform)) continue;
    dead.push(room.id);
  }
  if (dead.length === 0) return 0;

  const { count } = await prisma.room.updateMany({
    where: { id: { in: dead } },
    data: { status: "FINISHED", endedAt: new Date(now) },
  });
  return count;
}

let timer: NodeJS.Timeout | null = null;

/** Запускает периодическую уборку. Первый прогон — сразу после старта. */
export function startJanitor(): void {
  if (timer) return;

  const run = () => {
    sweepAbandonedRooms()
      .then((n) => {
        if (n > 0) console.log(`[janitor] закрыто брошенных комнат: ${n}`);
      })
      .catch((e) => console.error("[janitor] сбой уборки:", e));
  };

  run();
  timer = setInterval(run, SWEEP_INTERVAL_MS);
  // Уборка не должна удерживать процесс при выключении.
  timer.unref?.();
}

export function stopJanitor(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
