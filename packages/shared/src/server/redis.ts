// Singleton ioredis-клиент — общий для web и ws. Хранит горячее состояние
// онлайн-комнат: фаза, таймер, очередь слов. Долговременные данные — в Postgres.
//
// ВНИМАНИЕ: серверный модуль, в index.ts пакета не реэкспортируется.

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

let client: Redis | undefined;

function createClient(label: string): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set (см. .env в корне монорепо)");
  }
  const instance = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  instance.on("error", (err) => console.error(`[redis:${label}]`, err.message));
  instance.on("ready", () => console.log(`[redis:${label}] ready`));
  return instance;
}

/**
 * Возвращает общий клиент, создавая его при первом обращении.
 * Синглтон живёт в модуле; в dev дополнительно кладётся в globalThis,
 * чтобы hot reload не плодил соединения.
 */
export function getRedis(label: string): Redis {
  if (client) return client;
  client = globalForRedis.redis ?? createClient(label);
  if (process.env.NODE_ENV !== "production") globalForRedis.redis = client;
  return client;
}
