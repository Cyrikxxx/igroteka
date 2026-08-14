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
}

export function useTimer({ initialTime, onTimeUp, autoStart = false }: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);

  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  const countdownRef = useRef<Countdown>(createCountdown(initialTime));
  /** Чтобы onTimeUp не выстрелил дважды на одном раунде. */
  const firedRef = useRef(false);

  // Длительность раунда приезжает вместе с игрой, уже после первого рендера.
  useEffect(() => {
    countdownRef.current = createCountdown(initialTime);
    firedRef.current = false;
    setTimeLeft(initialTime);
  }, [initialTime]);

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

  return { timeLeft, isRunning, start, pause, reset };
}
