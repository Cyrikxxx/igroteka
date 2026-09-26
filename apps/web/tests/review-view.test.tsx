// Экран разбора слов после хода.
//
// Здесь была потеря, из-за которой у стола «пропадала кнопка передачи хода»:
// весь экран заменялся надписью «Подсчитываем итоги…», если отдельное событие
// с итогами раунда не доехало. Выйти оттуда было нечем — фаза ждёт
// подтверждения объясняющего, а он видит ту же заглушку.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewView } from "@/app/alias/room/[code]/play/page";

const REVIEW = {
  teamId: 1,
  words: [
    { wordId: 1, text: "маяк", guessed: true, order: 1 },
    { wordId: 2, text: "сова", guessed: false, order: 2 },
  ],
  scorePreview: 1,
};

function show(over: Partial<Parameters<typeof ReviewView>[0]> = {}) {
  render(
    <ReviewView
      role="explainer"
      trio={false}
      pairName="Лисы"
      review={REVIEW}
      penaltySkip={false}
      onToggle={vi.fn()}
      onConfirm={vi.fn()}
      isExplainer
      nextExplainerOffline={false}
      nextExplainerName="Аня"
      fallbackCounts={null}
      {...over}
    />,
  );
}

const CONFIRM = /Подтвердить · передать ход/;

describe("разбор слов", () => {
  it("объясняющий видит кнопку передачи хода", () => {
    show();
    expect(screen.getByText(CONFIRM)).toBeTruthy();
  });

  it("кнопка есть и без пришедших итогов", () => {
    show({ review: null, fallbackCounts: { got: 3, skip: 1 } });
    expect(screen.getByText(CONFIRM)).toBeTruthy();
  });

  it("без итогов счёт берётся из снимка комнаты", () => {
    // Он там уже есть и обновляется на каждом «угадал / пропустил».
    show({ review: null, fallbackCounts: { got: 3, skip: 1 }, penaltySkip: true });
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("кнопка не гаснет, когда следующий игрок не в сети", () => {
    // Телефоны за столом блокируют экран постоянно, и погасшая кнопка
    // читалась как «её нет». Ход теперь ждёт человека на экране «Начать».
    show({ nextExplainerOffline: true });
    const btn = screen.getByText(CONFIRM).closest("button");
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(false);
    expect(screen.getByText(/Аня не в сети/)).toBeTruthy();
  });

  it("не объясняющему кнопки нет, но экран не пустой", () => {
    show({ isExplainer: false, role: "guesser" });
    expect(screen.queryByText(CONFIRM)).toBeNull();
    expect(screen.getByText(/Ждём, пока объясняющий подтвердит/)).toBeTruthy();
  });
});
