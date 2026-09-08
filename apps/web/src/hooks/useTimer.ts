"use client";

// Таймер раунда локальной игры. В онлайне время считает сервер и присылает
// в tick.msLeft — этот хук нужен только режиму «на одном устройстве».
//
// Вся арифметика — в @alias/shared/countdown (она покрыта тестами с
// поддельными часами). Здесь только React-обвязка: состояние, интервал
// перерисовки и вызов onTimeUp.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCountdown,
  startCountdown,
  pauseCountdown,
  remainingSeconds,
  isExpired,
  type Countdown,
} from "@alias/shared/countdown";

/** Как часто перерисовываем остаток. На длительность раунда не влияет. */
const TICK_MS = 250;

interface UseTimerOptions {
  initialTime: number;
  onTimeUp?: () => void;
  autoStart?: boolean;
  /**
   * Отсчёт, восстановленный после перезагрузки вкладки. Передаётся один раз,
   * при первом рендере; дальше меняется только через start/pause/reset.
   */
  restore?: Countdown | null;
}

export function useTimer({
  initialTime,
  onTimeUp,
  autoStart = false,
  restore = null,
}: UseTimerOptions) {
  // При восстановлении показываем сохранённый остаток сразу: иначе на экране
  // на четверть секунды загорелся бы полный раунд и только потом сменился.
  const [timeLeft, setTimeLeft] = useState(() =>
    restore ? remainingSeconds(restore, Date.now()) : initialTime,
  );
  const [isRunning, setIsRunning] = useState(autoStart);

  const onTimeUpRef = useRef(onTimeUp);
  // Обновляем в эффекте, а не при рендере: колбэк зовётся из интервала, то
  // есть всегда после монтирования.
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  });

  const countdownRef = useRef<Countdown>(restore ?? createCountdown(initialTime));
  /**
   * Восстановленный отсчёт не сбрасываем, когда доедет длительность раунда.
   * Состояние, а не ref: флаг читается прямо при рендере, а рефы там трогать
   * нельзя. Значение берётся один раз при монтировании и больше не меняется.
   */
  const [isRestored] = useState(restore !== null);
  /** Чтобы onTimeUp не выстрелил дважды на одном раунде. */
  const firedRef = useRef(false);

  // Длительность раунда приезжает вместе с игрой, уже после первого рендера:
  // сначала подставляется значение по умолчанию, потом настоящее.
  //
  // Остаток поправляем прямо при рендере, сравнив с прежней длительностью, —
  // React разрешает такую подгонку и советует её вместо эффекта с setState:
  // лишней перерисовки не будет. Эффекту остаются только ссылки.
  const [seed, setSeed] = useState(initialTime);
  if (seed !== initialTime && !isRestored) {
    setSeed(initialTime);
    setTimeLeft(initialTime);
  }
  useEffect(() => {
    if (isRestored) return;
    countdownRef.current = createCountdown(initialTime);
    firedRef.current = false;
  }, [initialTime, isRestored]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTimeLeft(remainingSeconds(countdownRef.current, now));
      if (isExpired(countdownRef.current, now) && !firedRef.current) {
        firedRef.current = true;
        countdownRef.current = pauseCountdown(countdownRef.current, now);
        setIsRunning(false);
        onTimeUpRef.current?.();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isRunning]);

  const start = useCallback(() => {
    const now = Date.now();
    if (isExpired(countdownRef.current, now)) return;
    countdownRef.current = startCountdown(countdownRef.current, now);
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    const now = Date.now();
    countdownRef.current = pauseCountdown(countdownRef.current, now);
    setTimeLeft(remainingSeconds(countdownRef.current, now));
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    countdownRef.current = createCountdown(initialTime);
    firedRef.current = false;
    setIsRunning(false);
    setTimeLeft(initialTime);
  }, [initialTime]);

  /**
   * Текущий отсчёт как есть — чтобы его можно было сохранить и восстановить.
   * Функция, а не значение: отсчёт живёт в ref и на перерисовки не влияет.
   */
  const snapshot = useCallback(() => countdownRef.current, []);

  return { timeLeft, isRunning, start, pause, reset, snapshot };
}
