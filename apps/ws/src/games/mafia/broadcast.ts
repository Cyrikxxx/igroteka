// Персонализированный бродкаст состояния Мафии. В отличие от Алиаса
// (один общий snapshot всем), здесь каждому сокету уходит СВОЙ MafiaView —
// иначе тайные роли утекут. Дебаунс 50мс, как у Алиаса.

import { load } from "./snapshot";
import { buildView } from "./view";
import type { MafiaNamespace } from "./io-types";
import {
  createDebouncer,
  STATE_BROADCAST_DEBOUNCE_MS,
} from "../../lib/debounce";

export const mafiaRoom = (code: string) => `mafia:${code}`;

const debouncer = createDebouncer(STATE_BROADCAST_DEBOUNCE_MS);

async function emitPersonalized(ns: MafiaNamespace, code: string): Promise<void> {
  const snap = await load(code);
  if (!snap) return;
  const sockets = await ns.in(mafiaRoom(code)).fetchSockets();
  for (const s of sockets) {
    s.emit("mafia:state", buildView(snap, s.data.userId));
  }
}

/** Дебаунс — несколько мутаций подряд сольются в один бродкаст. */
export function scheduleStateBroadcast(ns: MafiaNamespace, code: string): void {
  debouncer.schedule(code, () => emitPersonalized(ns, code));
}

/** Немедленный персонализированный бродкаст (hello, смена фазы). */
export async function broadcastStateNow(
  ns: MafiaNamespace,
  code: string,
): Promise<void> {
  await emitPersonalized(ns, code);
}

/** Тик таймера — общий для комнаты (без секретов). */
export function emitTick(
  ns: MafiaNamespace,
  code: string,
  msLeft: number,
  paused: boolean,
): void {
  ns.to(mafiaRoom(code)).emit("mafia:tick", { msLeft, paused });
}
