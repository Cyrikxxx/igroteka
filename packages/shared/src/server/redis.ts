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

/**
 * Ленивая обёртка: соединение открывается на первом обращении к методу,
 * а не в момент импорта модуля.
 *
 * Это принципиально для сборки образа — `next build` импортирует все
 * API-роуты, чтобы собрать метаданные, и жадный клиент падал бы с
 * «REDIS_URL is not set». Секретов на сборке быть не должно: они
 * появляются только при запуске контейнера.
 */
export function lazyRedis(label: string): Redis {
  return new Proxy({} as Redis, {
    get(_target, prop) {
      const instance = getRedis(label) as unknown as Record<string | symbol, unknown>;
      const value = instance[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}
