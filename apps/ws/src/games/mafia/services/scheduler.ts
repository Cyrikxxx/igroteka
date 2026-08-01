// Серверные таймеры фаз Мафии. На каждую комнату — один тик-интервал и один
// дедлайн. По истечении вызывается onExpire (диспетчер фаз из engine).
// Хранятся в памяти процесса, как таймеры раунда у Алиаса; рассчитано на
// один инстанс ws. Дедлайн дублируется в снапшоте (`timerEndsAt`), чтобы
// таймер можно было восстановить после перезапуска процесса.

import { emitTick } from "../broadcast";
import type { MafiaNamespace } from "../io-types";

interface Entry {
  tick: NodeJS.Timeout;
  deadline: NodeJS.Timeout;
  endsAt: number;
}

const timers = new Map<string, Entry>();

export function clearTimer(code: string): void {
  const e = timers.get(code);
  if (e) {
    clearInterval(e.tick);
    clearTimeout(e.deadline);
    timers.delete(code);
  }
}

/** Запустить таймер фазы: тики раз в секунду + дедлайн → onExpire. */
export function startTimer(
  ns: MafiaNamespace,
  code: string,
  ms: number,
  onExpire: () => void | Promise<void>,
): number {
  clearTimer(code);
  const endsAt = Date.now() + ms;
  emitTick(ns, code, ms, false);
  const tick = setInterval(() => {
    emitTick(ns, code, Math.max(0, endsAt - Date.now()), false);
  }, 1000);
  const deadline = setTimeout(() => {
    clearTimer(code);
    void onExpire();
  }, ms);
  timers.set(code, { tick, deadline, endsAt });
  return endsAt;
}

export function hasTimer(code: string): boolean {
  return timers.has(code);
}

export function remainingMs(code: string): number | null {
  const e = timers.get(code);
  return e ? Math.max(0, e.endsAt - Date.now()) : null;
}
