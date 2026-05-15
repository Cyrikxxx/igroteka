// Singleton ioredis-клиент для web. Тот же `REDIS_URL`, что и в apps/ws,
// поэтому web и WS-сервер пишут/читают один Upstash.
//
// В production на Vercel при cold-start процесс перерабатывается, соединение
// перезаключается. На длинноживущем процессе (dev) singleton переиспользуется.

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set (см. .env в корне монорепо)");
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => console.error("[redis:web]", err.message));
  return client;
}

export const redis = globalForRedis.redis ?? createClient();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export default redis;
