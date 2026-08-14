// Обратный отсчёт по дедлайну — ядро таймера раунда, без React и без DOM,
// чтобы его можно было проверить тестами с поддельными часами.
//
// Прошлая реализация уменьшала счётчик на единицу каждый setInterval(…, 1000)
// и пересоздавала интервал после каждой секунды, поэтому раунд шёл дольше
// заявленного, а в свёрнутой вкладке (браузер душит таймеры) — заметно дольше.
// Здесь состояние — это момент окончания; сколько раз мы посмотрели на часы,
// на длительность не влияет.

export interface Countdown {
  /** Момент окончания, мс эпохи. null — отсчёт стоит. */
  endsAt: number | null;
  /** Остаток на момент паузы, мс. Пока идём — не используется. */
  remainingMs: number;
}

/** Отсчёт на `seconds` секунд, ещё не запущенный. */
export function createCountdown(seconds: number): Countdown {
  return { endsAt: null, remainingMs: Math.max(0, seconds) * 1000 };
}

/** Пустить (или возобновить с того места, где остановились). */
export function startCountdown(c: Countdown, now: number): Countdown {
  if (c.endsAt !== null) return c; // уже идёт
  if (c.remainingMs <= 0) return c; // время вышло, пускать нечего
  return { endsAt: now + c.remainingMs, remainingMs: c.remainingMs };
}

/** Остановить, запомнив остаток. */
export function pauseCountdown(c: Countdown, now: number): Countdown {
  if (c.endsAt === null) return c;
  return { endsAt: null, remainingMs: remainingMs(c, now) };
}

/** Остаток в миллисекундах. Никогда не отрицательный. */
export function remainingMs(c: Countdown, now: number): number {
  if (c.endsAt === null) return c.remainingMs;
  return Math.max(0, c.endsAt - now);
}

/**
 * Остаток в секундах для показа. Округляем вверх: пока идёт последняя
 * секунда, на экране горит «1», а ноль появляется ровно в момент конца.
 */
export function remainingSeconds(c: Countdown, now: number): number {
  return Math.ceil(remainingMs(c, now) / 1000);
}

/** Время вышло? */
export function isExpired(c: Countdown, now: number): boolean {
  return remainingMs(c, now) === 0;
}
