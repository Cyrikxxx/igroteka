// Локальный таймер раунда: обратный отсчёт, пауза и однократный сигнал
// «время вышло».
//
// Отсчёт запускается вызовом start() — как это делает экран раунда. Флаг
// autoStart только помечает таймер идущим, сам отсчёт он не заводит, и в
// проде им никто не пользуется.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTimer } from "@/hooks/useTimer";

describe("useTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("пока не запустили — стоит на месте", () => {
    const { result } = renderHook(() => useTimer({ initialTime: 60 }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(60);
  });

  it("запустили — считает вниз", () => {
    const { result } = renderHook(() => useTimer({ initialTime: 60 }));
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBeLessThan(60);
    expect(result.current.isRunning).toBe(true);
  });

  it("на паузе время не идёт", () => {
    const { result } = renderHook(() => useTimer({ initialTime: 60 }));
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      result.current.pause();
    });
    const atPause = result.current.timeLeft;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.timeLeft).toBe(atPause);
    expect(result.current.isRunning).toBe(false);
  });

  it("«время вышло» срабатывает ровно один раз за раунд", () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() => useTimer({ initialTime: 2, onTimeUp }));
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it("сменилась длительность раунда — отсчёт начинается заново", () => {
    // Длительность приезжает вместе с партией, уже после первого рендера:
    // сначала подставляется значение по умолчанию, потом настоящее.
    const { result, rerender } = renderHook(
      ({ initialTime }: { initialTime: number }) => useTimer({ initialTime }),
      { initialProps: { initialTime: 60 } },
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBeLessThan(60);

    rerender({ initialTime: 90 });
    expect(result.current.timeLeft).toBe(90);
  });

  it("reset возвращает к началу и останавливает", () => {
    const { result } = renderHook(() => useTimer({ initialTime: 45 }));
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.timeLeft).toBe(45);
    expect(result.current.isRunning).toBe(false);
  });
});
