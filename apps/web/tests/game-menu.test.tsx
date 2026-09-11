// Служебное меню партии. Вход в него — единственная кнопка, и если она не
// нарисовалась, из партии нельзя ни выйти, ни завершить её: рычаги внутри.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Flag } from "lucide-react";
import GameMenu from "@/components/common/GameMenu";
import MafiaGameMenu from "@/components/mafia/GameMenu";
import PhaseHead from "@/components/mafia/PhaseHead";

const noop = () => {};

const mafiaProps = {
  isHost: false,
  canPause: false,
  paused: false,
  canClaimHost: false,
  claimSecondsLeft: 0,
  hostGone: false,
  onPause: noop,
  onResume: noop,
  onEndGame: noop,
  onClaimHost: noop,
  onLeave: noop,
};

describe("меню партии", () => {
  it("вход виден, пока есть хоть один пункт", () => {
    render(<GameMenu items={[{ icon: Flag, label: "Завершить игру", onClick: noop }]} />);
    expect(screen.getByLabelText("Меню игры")).toBeTruthy();
  });

  it("пунктов нет — нет и входа", () => {
    render(<GameMenu items={[]} />);
    expect(screen.queryByLabelText("Меню игры")).toBeNull();
  });

  it("открывается и зовёт действие", () => {
    const onClick = vi.fn();
    render(<GameMenu items={[{ icon: Flag, label: "Завершить игру", onClick }]} />);
    fireEvent.click(screen.getByLabelText("Меню игры"));
    fireEvent.click(screen.getByText("Завершить игру"));
    expect(onClick).toHaveBeenCalledTimes(1);
    // И закрывается за собой, чтобы панель не висела поверх игры.
    expect(screen.getByLabelText("Меню игры")).toBeTruthy();
  });
});

describe("меню Мафии", () => {
  it("рядовому игроку доступен выход", () => {
    render(<MafiaGameMenu {...mafiaProps} />);
    fireEvent.click(screen.getByLabelText("Меню игры"));
    expect(screen.getByText("Выйти из игры")).toBeTruthy();
    expect(screen.queryByText("Завершить партию")).toBeNull();
  });

  it("хосту — пауза и завершение партии", () => {
    render(<MafiaGameMenu {...mafiaProps} isHost canPause />);
    fireEvent.click(screen.getByLabelText("Меню игры"));
    expect(screen.getByText("Поставить на паузу")).toBeTruthy();
    expect(screen.getByText("Завершить партию")).toBeTruthy();
  });

  it("комнату можно забрать, когда хост пропал", () => {
    render(<MafiaGameMenu {...mafiaProps} hostGone canClaimHost />);
    fireEvent.click(screen.getByLabelText("Меню игры"));
    expect(screen.getByText("Взять комнату")).toBeTruthy();
  });

  it("пока минута не прошла — объясняем, а не молчим", () => {
    render(<MafiaGameMenu {...mafiaProps} hostGone claimSecondsLeft={30} />);
    fireEvent.click(screen.getByLabelText("Меню игры"));
    expect(screen.getByText(/Взять комнату можно через 30 с/)).toBeTruthy();
  });
});

describe("облик зоны", () => {
  it("в Алиасе кнопка — та же .icon-btn, что пауза на одном устройстве", () => {
    // Именно класс, а не копия его стилей: копия разошлась бы с оригиналом.
    render(<GameMenu skin="alias" items={[{ icon: Flag, label: "Завершить игру", onClick: noop }]} />);
    const btn = screen.getByLabelText("Меню игры");
    expect(btn.classList.contains("icon-btn")).toBe(true);
    expect(document.querySelector('.gm[data-skin="alias"]')).toBeTruthy();
  });

  it("в Мафии — своя круглая, без класса Алиаса", () => {
    render(<MafiaGameMenu {...mafiaProps} />);
    const btn = screen.getByLabelText("Меню игры");
    expect(btn.classList.contains("icon-btn")).toBe(false);
    expect(document.querySelector('.gm[data-skin="mafia"]')).toBeTruthy();
  });

  it("в потоке меню не накладка, а обычный элемент шапки", () => {
    render(<GameMenu inline items={[{ icon: Flag, label: "Завершить игру", onClick: noop }]} />);
    expect(document.querySelector(".gm")?.hasAttribute("data-inline")).toBe(true);
  });
});

describe("меню в шапке фазы Мафии", () => {
  it("стоит внутри шапки, а не накладкой поверх экрана", () => {
    // Накладка держалась на `position: absolute; right: 16`, а шапка держит
    // таймер на `right: 20` — они занимали одно место.
    render(
      <PhaseHead
        icon={Flag}
        title="Ночь 2"
        timerMs={102_000}
        menu={<MafiaGameMenu {...mafiaProps} />}
      />,
    );
    const head = document.querySelector(".mf-phase-head");
    expect(head).toBeTruthy();
    expect(head?.querySelector(".gm")).toBeTruthy();
    // И таймер никуда не делся — он сосед, а не подложка.
    expect(screen.getByText("1:42")).toBeTruthy();
  });

  it("в Мафии иконка не три точки", () => {
    render(<MafiaGameMenu {...mafiaProps} />);
    expect(screen.getByLabelText("Меню игры").querySelector("svg")?.classList.toString())
      .toContain("lucide-menu");
  });
});
