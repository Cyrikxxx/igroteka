// Схлопывание частых бродкастов состояния. Мутации обычно идут цепочкой
// (например, team:join → смена онлайн-флага → рассылка), и без дебаунса
// клиент получил бы серию почти одинаковых снимков вместо одного свежего.

/** Задержка рассылки состояния комнаты — одинаковая для обеих игр. */
export const STATE_BROADCAST_DEBOUNCE_MS = 50;

export interface Debouncer {
  /**
   * Планирует запуск по ключу. Пока запуск не состоялся, повторные вызовы
   * с тем же ключом игнорируются — сработает один раз, с актуальными данными.
   */
  schedule(key: string, run: () => void | Promise<void>): void;
  /** Снимает запланированный запуск (например, комната закрылась). */
  cancel(key: string): void;
}

export function createDebouncer(delayMs: number): Debouncer {
  const pending = new Map<string, NodeJS.Timeout>();
  return {
    schedule(key, run) {
      if (pending.has(key)) return;
      const handle = setTimeout(() => {
        pending.delete(key);
        void run();
      }, delayMs);
      pending.set(key, handle);
    },
    cancel(key) {
      const handle = pending.get(key);
      if (handle) {
        clearTimeout(handle);
        pending.delete(key);
      }
    },
  };
}
