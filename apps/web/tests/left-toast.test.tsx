// Уведомление «игрок вышел из партии».
//
// Уход выглядит по-разному: в лобби человека вычёркивают из списка, а в идущей
// партии оставляют с пометкой `eliminatedBy: "left"` — иначе вместе с ним
// пропала бы его роль. Тост должен ловить оба случая и молчать про обрывы
// связи: там человек, скорее всего, вернётся.

import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LeftToast, useLeftToast } from "@/components/mafia/Overlays";

type P = { userId: string; displayName: string; eliminatedBy?: string; online?: boolean };

/** Крошечный экран: хук + тост, как на настоящей странице. */
function Harness({ players }: { players: P[] }) {
  const t = useLeftToast(players);
  return <LeftToast name={t.name} inLobby={t.inLobby} onClose={t.close} />;
}

describe("уведомление о выходе", () => {
  it("на первом рендере молчит, даже если кто-то уже вышел", () => {
    render(<Harness players={[{ userId: "a", displayName: "Аня", eliminatedBy: "left" }]} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("показывает, кто вышел посреди партии", () => {
    const { rerender } = render(
      <Harness players={[{ userId: "a", displayName: "Аня" }, { userId: "b", displayName: "Боря" }]} />,
    );
    rerender(
      <Harness
        players={[
          { userId: "a", displayName: "Аня", eliminatedBy: "left" },
          { userId: "b", displayName: "Боря" },
        ]}
      />,
    );
    expect(screen.getByText("Аня вышел из игры")).toBeTruthy();
    expect(screen.getByText("Партия продолжается без него")).toBeTruthy();
  });

  it("в лобби ловит исчезновение из списка", () => {
    const { rerender } = render(
      <Harness players={[{ userId: "a", displayName: "Аня" }, { userId: "b", displayName: "Боря" }]} />,
    );
    rerender(<Harness players={[{ userId: "b", displayName: "Боря" }]} />);
    expect(screen.getByText("Аня вышел из игры")).toBeTruthy();
    expect(screen.getByText("Освободилось место в комнате")).toBeTruthy();
  });

  it("молчит про обрыв связи — это не уход", () => {
    const { rerender } = render(
      <Harness players={[{ userId: "a", displayName: "Аня", online: true }]} />,
    );
    rerender(<Harness players={[{ userId: "a", displayName: "Аня", online: false }]} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("молчит про смерть от мафии", () => {
    const { rerender } = render(<Harness players={[{ userId: "a", displayName: "Аня" }]} />);
    rerender(<Harness players={[{ userId: "a", displayName: "Аня", eliminatedBy: "mafia" }]} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("сам пропадает через несколько секунд", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Harness players={[{ userId: "a", displayName: "Аня" }]} />);
      rerender(<Harness players={[{ userId: "a", displayName: "Аня", eliminatedBy: "left" }]} />);
      expect(screen.getByRole("status")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
