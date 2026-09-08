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

  // ── Восстановление после перезагрузки вкладки ──
  //
  // Длительность раунда приезжает вместе с игрой, то есть позже первого
  // рендера. Пока восстановления не было, хук просто пересоздавал отсчёт на
  // новую длительность — и восстановленный остаток был бы затёрт полным
  // раундом. Ровно из-за этого перезагрузка посреди раунда начинала всё
  // заново.
  describe("восстановление", () => {
    it("продолжает с сохранённого остатка, а не с полного раунда", () => {
      const { result } = renderHook(() =>
        useTimer({
          initialTime: 60,
          restore: { endsAt: null, remainingMs: 12_000 },
        }),
      );
      act(() => {
        result.current.start();
      });
      expect(result.current.timeLeft).toBeLessThanOrEqual(12);
      expect(result.current.timeLeft).toBeGreaterThan(0);
    });

    it("поздно приехавшая длительность раунда не затирает остаток", () => {
      const { result, rerender } = renderHook(
        ({ time }: { time: number }) =>
          useTimer({
            initialTime: time,
            restore: { endsAt: null, remainingMs: 12_000 },
          }),
        { initialProps: { time: 60 } },
      );
      // Игра загрузилась и принесла настоящую длительность.
      rerender({ time: 90 });
      act(() => {
        result.current.start();
      });
      expect(result.current.timeLeft).toBeLessThanOrEqual(12);
    });

    it("отдаёт свой отсчёт наружу — его и сохраняют", () => {
      const { result } = renderHook(() => useTimer({ initialTime: 45 }));
      expect(result.current.snapshot().remainingMs).toBe(45_000);
      act(() => {
        result.current.start();
      });
      expect(result.current.snapshot().endsAt).not.toBeNull();
    });

    it("истёкший отсчёт не запускается заново", () => {
      const { result } = renderHook(() =>
        useTimer({ initialTime: 60, restore: { endsAt: null, remainingMs: 0 } }),
      );
      act(() => {
        result.current.start();
      });
      expect(result.current.isRunning).toBe(false);
    });
  });
});
