// Снимок комнаты Мафии в Redis (ключ mafia:room:<code>, TTL 24ч).
// Механика — @alias/shared/server/snapshot-store, построение —
// mafia-snapshot-builders.

import type { MafiaSnapshot } from "@alias/shared/mafia";
import { mafiaRoomKey } from "@alias/shared/redis-keys";
import { createSnapshotStore } from "@alias/shared/server/snapshot-store";
import { mafiaSnapshotTtl } from "@alias/shared/mafia-snapshot-builders";
import redis from "./redis";

export { buildMafiaLobbySnapshot } from "@alias/shared/mafia-snapshot-builders";

const store = createSnapshotStore<MafiaSnapshot>(redis, mafiaRoomKey, mafiaSnapshotTtl);

export const saveMafiaSnapshot = store.save;
export const loadMafiaSnapshot = store.load;
export const deleteMafiaSnapshot = store.remove;
