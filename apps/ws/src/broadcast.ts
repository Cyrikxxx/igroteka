// Дебаунс room:state бродкастов: соседние во времени мутации часто
// случаются цепочкой (team:join → setOnline → broadcast). Шлём пользователю
// один свежий снимок через 50мс, а не серию.
//
// PROMPT.md §2.4.4: «room:state — после любых изменений (debounce 50ms)».

import type { RoomSnapshot } from "@alias/shared/domain";
import { load } from "./snapshot";
import type { AppNamespace } from "./io-types";

const DEBOUNCE_MS = 50;
const pending = new Map<string, NodeJS.Timeout>();

export function scheduleStateBroadcast(
  ns: AppNamespace,
  code: string,
): void {
  if (pending.has(code)) return;
  const handle = setTimeout(async () => {
    pending.delete(code);
    const snap = await load(code);
    if (snap) ns.to(`room:${code}`).emit("room:state", snap);
  }, DEBOUNCE_MS);
  pending.set(code, handle);
}

/** Immediate broadcast (для room:hello, где клиенту нужно сразу синхронизироваться). */
export function broadcastStateNow(
  ns: AppNamespace,
  code: string,
  snap: RoomSnapshot,
): void {
  ns.to(`room:${code}`).emit("room:state", snap);
}
