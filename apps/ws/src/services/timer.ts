// Серверный per-room таймер. Один setInterval на комнату, тикает раз в
// секунду, эмитит `round:tick`. При msLeft===0 вызывает onTimeUp.

const intervals = new Map<string, NodeJS.Timeout>();

export interface TimerHandle {
  stop: () => void;
}

export function startTimer(
  code: string,
  tick: () => void,
  intervalMs: number = 1000,
): TimerHandle {
  stopTimer(code);
  const handle = setInterval(tick, intervalMs);
  intervals.set(code, handle);
  return { stop: () => stopTimer(code) };
}

export function stopTimer(code: string): void {
  const existing = intervals.get(code);
  if (existing) {
    clearInterval(existing);
    intervals.delete(code);
  }
}

export function isRunning(code: string): boolean {
  return intervals.has(code);
}

export function stopAllTimers(): void {
  for (const h of intervals.values()) clearInterval(h);
  intervals.clear();
}
