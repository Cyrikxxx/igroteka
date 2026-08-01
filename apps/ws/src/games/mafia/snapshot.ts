// Полный снапшот партии Мафии в Redis (ключ mafia:room:<code>).
// Содержит тайные роли — клиенту целиком НЕ уходит, каждому сокету
// строится персональный MafiaView (см. view.ts).

import { mafiaRoomKey } from "@alias/shared/redis-keys";
import type { MafiaSnapshot } from "@alias/shared/mafia";
import { createSnapshotStore } from "@alias/shared/server/snapshot-store";
import { redis } from "../../redis";

const store = createSnapshotStore<MafiaSnapshot>(redis, mafiaRoomKey);

export const { load, save, mutate, remove } = store;
