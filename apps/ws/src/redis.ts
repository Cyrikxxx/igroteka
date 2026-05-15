// Redis-клиент для горячего состояния онлайн-комнат (Upstash через rediss://).
// См. PROMPT.md §2.1.1, §2.6.5, §2.6.8.

import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
  throw new Error("REDIS_URL is required (см. .env в корне монорепо)");
}

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("[redis] error:", err.message);
});

redis.on("connect", () => {
  console.log("[redis] connected");
});

redis.on("ready", () => {
  console.log("[redis] ready");
});
