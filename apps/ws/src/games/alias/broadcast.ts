// Рассылка room:state всем участникам комнаты Алиаса: один общий снимок
// на всех (в отличие от Мафии, где вид персональный).

import type { RoomSnapshot } from "@alias/shared/domain";
import { load } from "./snapshot";
import type { AppNamespace } from "./io-types";
import {
  createDebouncer,
  STATE_BROADCAST_DEBOUNCE_MS,
} from "../../lib/debounce";

const debouncer = createDebouncer(STATE_BROADCAST_DEBOUNCE_MS);

export function scheduleStateBroadcast(
  ns: AppNamespace,
  code: string,
): void {
  debouncer.schedule(code, async () => {
    const snap = await load(code);
    if (snap) ns.to(`room:${code}`).emit("room:state", snap);
  });
}

/** Immediate broadcast (для room:hello, где клиенту нужно сразу синхронизироваться). */
export function broadcastStateNow(
  ns: AppNamespace,
  code: string,
  snap: RoomSnapshot,
): void {
  ns.to(`room:${code}`).emit("room:state", snap);
}
