// Снимок комнаты Мафии в Redis (ключ mafia:room:<code>, TTL 24ч).
// Механика — @igroteka/shared/server/snapshot-store, построение —
// mafia-snapshot-builders.

import type { MafiaSnapshot } from "@igroteka/shared/mafia";
import { mafiaRoomKey } from "@igroteka/shared/redis-keys";
import { createSnapshotStore } from "@igroteka/shared/server/snapshot-store";
import { mafiaSnapshotTtl } from "@igroteka/shared/mafia-snapshot-builders";
import redis from "./redis";

export { buildMafiaLobbySnapshot } from "@igroteka/shared/mafia-snapshot-builders";

const store = createSnapshotStore<MafiaSnapshot>(redis, mafiaRoomKey, mafiaSnapshotTtl);

export const saveMafiaSnapshot = store.save;
export const loadMafiaSnapshot = store.load;
export const deleteMafiaSnapshot = store.remove;
