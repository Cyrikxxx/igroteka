// Полный снапшот партии Мафии в Redis (ключ mafia:room:<code>).
// Содержит тайные роли — клиенту целиком НЕ уходит, каждому сокету
// строится персональный MafiaView (см. view.ts).

import { mafiaRoomKey } from "@igroteka/shared/redis-keys";
import type { MafiaSnapshot } from "@igroteka/shared/mafia";
import { createSnapshotStore } from "@igroteka/shared/server/snapshot-store";
import { mafiaSnapshotTtl } from "@igroteka/shared/mafia-snapshot-builders";
import { redis } from "../../redis";

const store = createSnapshotStore<MafiaSnapshot>(redis, mafiaRoomKey, mafiaSnapshotTtl);

export const { load, save, mutate, remove } = store;
