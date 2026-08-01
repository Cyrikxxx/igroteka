// Общий ioredis-клиент (packages/shared/src/server/redis.ts).
// Тот же REDIS_URL, что и у apps/ws — оба читают и пишут один Redis.

import { lazyRedis } from "@alias/shared/server/redis";

// Ленивый: `next build` импортирует API-роуты, а REDIS_URL на сборке нет.
export const redis = lazyRedis("web");

export default redis;
