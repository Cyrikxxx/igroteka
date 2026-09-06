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

/**
 * Запустить таймер фазы: тики раз в секунду + дедлайн → onExpire.
 *
 * `silent` — не рассылать тики. Нужен ночью в режиме ведущего: длина шага
 * там сама по себе секрет (у мёртвой роли она случайная), и общий на комнату
 * обратный отсчёт выдал бы её всем сразу. Тому, чей ход, остаток приходит в
 * персональном виде.
 */
export function startTimer(
  ns: MafiaNamespace,
  code: string,
  ms: number,
  onExpire: () => void | Promise<void>,
  silent = false,
): number {
  clearTimer(code);
  const endsAt = Date.now() + ms;
  if (!silent) emitTick(ns, code, ms, false);
  const tick = setInterval(() => {
    if (!silent) emitTick(ns, code, Math.max(0, endsAt - Date.now()), false);
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
