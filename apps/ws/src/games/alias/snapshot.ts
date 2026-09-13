// Снапшот комнаты Алиаса в Redis (ключ room:<code>).
// Общая механика чтения/записи — @igroteka/shared/server/snapshot-store.

import { roomKey } from "@igroteka/shared/redis-keys";
import type { RoomSnapshot } from "@igroteka/shared/alias";
import { createSnapshotStore } from "@igroteka/shared/server/snapshot-store";
import { roomSnapshotTtl } from "@igroteka/shared/snapshot-builders";
import { redis } from "../../redis";

const store = createSnapshotStore<RoomSnapshot>(redis, roomKey, roomSnapshotTtl);

export const { load, save, mutate, remove } = store;
