// Снапшот комнаты Алиаса в Redis (ключ room:<code>).
// Общая механика чтения/записи — @alias/shared/server/snapshot-store.

import { roomKey } from "@alias/shared/redis-keys";
import type { RoomSnapshot } from "@alias/shared/domain";
import { createSnapshotStore } from "@alias/shared/server/snapshot-store";
import { roomSnapshotTtl } from "@alias/shared/snapshot-builders";
import { redis } from "../../redis";

const store = createSnapshotStore<RoomSnapshot>(redis, roomKey, roomSnapshotTtl);

export const { load, save, mutate, remove } = store;
