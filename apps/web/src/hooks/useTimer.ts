"use client";

// Клиентский таймер для локальной игры. Серверный аналог появится в онлайн-режиме.

import { useCallback, useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setTimeout(() => onTimeUpRef.current?.(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setTimeLeft(initialTime);
    setIsRunning(false);
  }, [initialTime]);

  return { timeLeft, isRunning, start, pause, reset };
}
