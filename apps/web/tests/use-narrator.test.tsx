// Озвучка ведущего. Реплика приходит с сервера готовой, поэтому проверять
// тут нужно ровно две вещи: что фраза звучит один раз и что на этом
// устройстве она звучит только когда её просили.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNarrator } from "@/hooks/useNarrator";
import { voiceEnabledFor } from "@/lib/voice-prefs";

/** Заглушка синтеза: jsdom его не реализует. */
const spoken: string[] = [];
let cancelled = 0;

beforeEach(() => {
  spoken.length = 0;
  cancelled = 0;
  vi.stubGlobal("speechSynthesis", {
    speak: (u: { text: string }) => spoken.push(u.text),
    cancel: () => {
      cancelled += 1;
    },
    getVoices: () => [{ lang: "ru-RU", name: "Milena" }],
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      lang = "";
      rate = 1;
      volume = 1;
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
});

const narration = (key: string, text: string) => ({ key, text });

describe("useNarrator", () => {
  it("произносит реплику один раз на ключ", () => {
    const { rerender } = renderHook(
      (props: { k: string }) =>
        useNarrator({ narration: narration(props.k, "Просыпается доктор."), enabled: true }),
      { initialProps: { k: "1:2:NIGHT:2:doctor" } },
    );
    // Состояние комнаты прилетает много раз подряд — фраза должна остаться одна.
    rerender({ k: "1:2:NIGHT:2:doctor" });
    rerender({ k: "1:2:NIGHT:2:doctor" });
    expect(spoken).toEqual(["Просыпается доктор."]);
  });

  it("пауза и продолжение сами по себе фразу не повторяют", () => {
    // Повторить вызов роли решает сервер — он поднимает счётчик повторов в
    // ключе. Клиент по своей воле переговаривать не должен, иначе любая
    // перерисовка на паузе звучала бы заново.
    const { rerender } = renderHook(
      (props: { paused: boolean }) =>
        useNarrator({
          narration: narration("0:1:NIGHT:1:mafia", "Просыпается мафия."),
          enabled: true,
          paused: props.paused,
        }),
      { initialProps: { paused: false } },
    );
    rerender({ paused: true });
    rerender({ paused: false });
    expect(spoken).toEqual(["Просыпается мафия."]);
  });

  it("новый ключ — новая реплика", () => {
    const { rerender } = renderHook(
      (props: { k: string; t: string }) =>
        useNarrator({ narration: narration(props.k, props.t), enabled: true }),
      { initialProps: { k: "a", t: "Просыпается мафия." } },
    );
    rerender({ k: "b", t: "Просыпается доктор." });
    expect(spoken).toEqual(["Просыпается мафия.", "Просыпается доктор."]);
  });

  it("после паузы ту же фразу повторяет — ключ меняет счётчик повторов", () => {
    const { rerender } = renderHook(
      (props: { k: string }) =>
        useNarrator({ narration: narration(props.k, "Просыпается мафия."), enabled: true }),
      { initialProps: { k: "0:1:NIGHT:1:mafia" } },
    );
    rerender({ k: "1:1:NIGHT:1:mafia" });
    expect(spoken).toHaveLength(2);
  });

  it("с выключенной озвучкой молчит", () => {
    renderHook(() =>
      useNarrator({ narration: narration("a", "Просыпается мафия."), enabled: false }),
    );
    expect(spoken).toEqual([]);
  });

  it("на паузе молчит и обрывает начатое", () => {
    const { rerender } = renderHook(
      (props: { paused: boolean }) =>
        useNarrator({
          narration: narration("a", "Просыпается мафия."),
          enabled: true,
          paused: props.paused,
        }),
      { initialProps: { paused: false } },
    );
    expect(spoken).toHaveLength(1);
    rerender({ paused: true });
    expect(cancelled).toBeGreaterThan(0);
  });

  it("уход со страницы обрывает реплику", () => {
    const { unmount } = renderHook(() =>
      useNarrator({ narration: narration("a", "Просыпается мафия."), enabled: true }),
    );
    const before = cancelled;
    unmount();
    expect(cancelled).toBeGreaterThan(before);
  });
});

describe("чьё устройство говорит", () => {
  it("по умолчанию — хост, остальные молчат", () => {
    expect(voiceEnabledFor(null, true)).toBe(true);
    expect(voiceEnabledFor(null, false)).toBe(false);
  });

  it("выбор человека сильнее умолчания", () => {
    expect(voiceEnabledFor("on", false)).toBe(true);
    expect(voiceEnabledFor("off", true)).toBe(false);
  });
});
