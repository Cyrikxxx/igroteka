// Снапшот комнаты Алиаса в Redis (ключ room:<code>).
// Общая механика чтения/записи — @alias/shared/server/snapshot-store.

import { roomKey } from "@alias/shared/redis-keys";
import type { RoomSnapshot } from "@alias/shared/domain";
import { createSnapshotStore } from "@alias/shared/server/snapshot-store";
import { redis } from "../../redis";

const store = createSnapshotStore<RoomSnapshot>(redis, roomKey);

export const { load, save, mutate, remove } = store;
