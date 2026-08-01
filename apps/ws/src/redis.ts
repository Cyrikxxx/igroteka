// Общий ioredis-клиент (packages/shared/src/server/redis.ts).
// Тот же REDIS_URL, что и у apps/web — оба читают и пишут один Redis.

import { getRedis } from "@alias/shared/server/redis";

export const redis = getRedis("ws");

export default redis;
