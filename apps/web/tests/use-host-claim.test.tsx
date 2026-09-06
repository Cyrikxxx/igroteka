// Отсчёт до «взять комнату на себя».
//
// Снапшот в это время не меняется — сервер один раз записал момент, когда хост
// пропал. Значит кнопка обязана появиться сама, по локальному тику; без него
// человеку пришлось бы перезагружать страницу, чтобы узнать, что ждать уже
// нечего.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { HOST_CLAIM_AFTER_MS } from "@alias/shared/constants";
import { useHostClaim } from "@/hooks/useHostClaim";

describe("useHostClaim", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("пока хост на связи — забирать нечего", () => {
    const { result } = renderHook(() => useHostClaim(null, false));
    expect(result.current.hostGone).toBe(false);
    expect(result.current.canClaim).toBe(false);
  });

  it("сам хост себе комнату не забирает", () => {
    const { result } = renderHook(() => useHostClaim(Date.now() - 10 * 60_000, true));
    expect(result.current.hostGone).toBe(false);
    expect(result.current.canClaim).toBe(false);
  });

  it("хост пропал — предупреждение сразу, кнопка только через минуту", () => {
    // Момент фиксируем заранее: если звать Date.now() внутри колбэка рендера,
    // отсчёт будет начинаться заново на каждой перерисовке.
    const goneAt = Date.now();
    const { result } = renderHook(() => useHostClaim(goneAt, false));
    expect(result.current.hostGone).toBe(true);
    expect(result.current.canClaim).toBe(false);
    expect(result.current.secondsLeft).toBeGreaterThan(0);
  });

  it("кнопка появляется сама, без перезагрузки страницы", () => {
    const goneAt = Date.now();
    const { result } = renderHook(() => useHostClaim(goneAt, false));
    expect(result.current.canClaim).toBe(false);

    // Ровно то, ради чего в хуке есть локальный тик: снапшот не менялся, а
    // кнопка обязана появиться.
    act(() => {
      vi.advanceTimersByTime(HOST_CLAIM_AFTER_MS + 1000);
    });
    expect(result.current.canClaim).toBe(true);
    expect(result.current.secondsLeft).toBe(0);
  });

  it("хост вернулся — кнопка пропадает", () => {
    const { result, rerender } = renderHook(
      ({ since }: { since: number | null }) => useHostClaim(since, false),
      { initialProps: { since: Date.now() - HOST_CLAIM_AFTER_MS - 1000 as number | null } },
    );
    expect(result.current.canClaim).toBe(true);

    rerender({ since: null });
    expect(result.current.canClaim).toBe(false);
    expect(result.current.hostGone).toBe(false);
  });
});
