// Рассылка room:state всем участникам комнаты Алиаса: один общий снимок
// на всех (в отличие от Мафии, где вид персональный).
//
// Единственная точка, через которую снимок уходит наружу. Раньше их было две —
// эта и одноимённая функция внутри handlers/round.ts, — и именно на стыке жила
// гонка, из-за которой у стола пропадала кнопка передачи хода:
//
//   t=0   чей-то телефон отвалился → запланирован дебаунс-бродкаст
//   t=50  колбэк стартует, выпускает чтение из Redis
//   t=51  таймер добивает раунд: фаза становится ROUND_REVIEW и рассылается
//   t=53  чтение возвращает снимок ИЗ ПРОШЛОГО и уходит всем
//
// Лечится двумя замками. Немедленная рассылка снимает запланированную: она по
// определению свежее. А то, что уже успело прочитаться, отсеивается по номеру
// ревизии — снимок с не большим `rev`, чем последний разосланный, не уходит.

import type { RoomSnapshot } from "@igroteka/shared/alias";
import { load } from "./snapshot";
import { loadRoundState, timerView } from "./services/roundState";
import type { AppNamespace } from "./io-types";
import {
  createDebouncer,
  STATE_BROADCAST_DEBOUNCE_MS,
} from "../../lib/debounce";

const debouncer = createDebouncer(STATE_BROADCAST_DEBOUNCE_MS);

/** Последняя разосланная ревизия по комнате. */
const sentRev = new Map<string, number>();

/**
 * Подставить живое время раунда.
 *
 * В снимке хранить остаток бессмысленно — он протухает через секунду, — поэтому
 * время живёт в RoundState и подставляется на каждой отправке. Без этого
 * вернувшийся в комнату получал полную длительность и видел застывший таймер.
 */
async function withLiveTimer(code: string, snap: RoomSnapshot): Promise<RoomSnapshot> {
  if (!snap.timer) return snap;
  const rs = await loadRoundState(code);
  if (!rs) return snap;
  return { ...snap, timer: timerView(rs) };
}

/** Разослать, если снимок не старше уже разосланного. */
function emitIfFresh(ns: AppNamespace, code: string, snap: RoomSnapshot): void {
  const rev = snap.rev;
  if (typeof rev === "number") {
    const last = sentRev.get(code);
    if (typeof last === "number" && rev <= last) return;
    sentRev.set(code, rev);
  }
  ns.to(`room:${code}`).emit("room:state", snap);
}

export function scheduleStateBroadcast(ns: AppNamespace, code: string): void {
  debouncer.schedule(code, async () => {
    const snap = await load(code);
    if (snap) emitIfFresh(ns, code, await withLiveTimer(code, snap));
  });
}

/** Снять запланированную рассылку: следом идёт более свежая. */
export function cancelStateBroadcast(code: string): void {
  debouncer.cancel(code);
}

/** Немедленная рассылка — для переходов фаз и room:hello. */
export async function broadcastStateNow(
  ns: AppNamespace,
  code: string,
  snap: RoomSnapshot,
): Promise<void> {
  cancelStateBroadcast(code);
  emitIfFresh(ns, code, await withLiveTimer(code, snap));
}

/** Комната закрылась — забыть о ней, иначе Map растёт бесконечно. */
export function forgetRoomBroadcast(code: string): void {
  cancelStateBroadcast(code);
  sentRev.delete(code);
}

/** Снимок с живым таймером для ack room:hello. */
export async function snapshotForClient(
  code: string,
  snap: RoomSnapshot,
): Promise<RoomSnapshot> {
  return withLiveTimer(code, snap);
}
