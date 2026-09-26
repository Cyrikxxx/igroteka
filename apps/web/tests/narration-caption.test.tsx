// Плашка с репликой ведущего.
//
// Она существует ради столов, где русского голоса на телефоне нет: читать с
// экрана — единственный способ играть. Поэтому проверяем, что текст доезжает,
// что плашка гаснет, договорив, и — главное — что её не забыли ни на одном
// экране: футеры у экранов разной высоты, и раньше плашка ложилась на кнопки.
//
// Чего этим тестом НЕ проверить: jsdom не считает стили, поэтому само
// затухание (CSS-переход) и то, что плашка стоит выше кнопок, остаются на
// ручной проверке. Что её не забыли ни на одном экране — в
// narration-caption-screens.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import NarrationCaption, {
  NarrationCaptionProvider,
} from "@/components/mafia/NarrationCaption";

const LINE = { key: "0:1:MORNING", text: "Наступает утро. Город просыпается." };

function show(value: typeof LINE | null) {
  return render(
    <NarrationCaptionProvider value={value}>
      <NarrationCaption />
    </NarrationCaptionProvider>,
  );
}

describe("плашка с репликой", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("показывает текст реплики", () => {
    show(LINE);
    expect(screen.getByText(LINE.text)).toBeTruthy();
  });

  it("реплики нет — нет и плашки", () => {
    show(null);
    expect(document.querySelector(".mf-caption")).toBeNull();
  });

  it("гаснет, когда ведущий договорил, и уходит из разметки", () => {
    // Иначе строка висела бы всю фазу: в обсуждении это две минуты.
    show(LINE);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(document.querySelector(".mf-caption")).toBeNull();
  });

  it("пока реплика звучит — висит", () => {
    show(LINE);
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText(LINE.text)).toBeTruthy();
  });
});
