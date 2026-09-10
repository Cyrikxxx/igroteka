// Настройки партии Мафии. Проверяется ручной ввод времени: он обязан
// клампиться ровно так же, как на сервере, иначе введённое хостом число
// молча заменялось бы на другое.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MafiaSettingsForm from "@/components/mafia/MafiaSettingsForm";
import { DEFAULT_MAFIA_SETTINGS, MAFIA_TIMER_LIMITS, type MafiaSettings } from "@alias/shared/mafia";

function settings(overrides: Partial<MafiaSettings["timers"]> = {}): MafiaSettings {
  return {
    ...DEFAULT_MAFIA_SETTINGS,
    roles: { ...DEFAULT_MAFIA_SETTINGS.roles },
    timers: { ...DEFAULT_MAFIA_SETTINGS.timers, ...overrides },
    rules: { ...DEFAULT_MAFIA_SETTINGS.rules },
  };
}

function renderForm(value: MafiaSettings, playerCount = 8) {
  const onChange = vi.fn();
  render(<MafiaSettingsForm value={value} onChange={onChange} playerCount={playerCount} />);
  return onChange;
}

/** Строка настройки целиком — по подписи внутри неё. */
function row(label: string): HTMLElement {
  const el = screen.getByText(label).closest(".mf-setting-row");
  if (!el) throw new Error(`нет строки настройки «${label}»`);
  return el as HTMLElement;
}

const field = (label: string) => screen.getByLabelText(`${label}: своё время в секундах`);

describe("своё время", () => {
  it("поле появляется по кнопке «Своё»", () => {
    renderForm(settings());
    expect(screen.queryByLabelText(/Обсуждение: своё/)).toBeNull();
    fireEvent.click(screen.getAllByText("Своё")[1]);
    expect(field("Обсуждение")).toBeTruthy();
  });

  it("введённое число уходит наверх как есть", () => {
    const onChange = renderForm(settings());
    fireEvent.click(screen.getAllByText("Своё")[1]);
    const input = field("Обсуждение");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].timers.discussion).toBe(150);
  });

  it("слишком большое и слишком малое зажимаются в границы сервера", () => {
    const onChange = renderForm(settings());
    fireEvent.click(screen.getAllByText("Своё")[1]);
    const input = field("Обсуждение");

    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.blur(input);
    expect(onChange.mock.calls[0][0].timers.discussion).toBe(
      MAFIA_TIMER_LIMITS.discussion.max,
    );

    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    expect(onChange.mock.calls[1][0].timers.discussion).toBe(
      MAFIA_TIMER_LIMITS.discussion.min,
    );
  });

  it("мусор в поле ничего не меняет", () => {
    const onChange = renderForm(settings());
    fireEvent.click(screen.getAllByText("Своё")[1]);
    const input = field("Обсуждение");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("значение не из списка открывает поле сразу", () => {
    // Иначе хост, задавший 97 секунд, увидел бы ряд чипов без единого
    // выбранного и не понял, сколько же стоит.
    renderForm(settings({ discussion: 97 }));
    expect((field("Обсуждение") as HTMLInputElement).value).toBe("97");
    expect(screen.getByText(/Сейчас — 1 мин 37 с/)).toBeTruthy();
  });

  it("выбор готового варианта закрывает поле", () => {
    const onChange = renderForm(settings({ discussion: 97 }));
    fireEvent.click(screen.getByText("2 мин"));
    expect(onChange.mock.calls[0][0].timers.discussion).toBe(120);
    expect(screen.queryByLabelText(/Обсуждение: своё/)).toBeNull();
  });
});

describe("дон", () => {
  it("при одной мафии тумблер недоступен", () => {
    // Пятеро игроков — авто-состав даёт одну мафию, и дона назначить некому.
    // Раньше тумблер горел включённым и обещал роль, которой не будет.
    renderForm(settings(), 5);
    const don = row("Дон");
    expect(don.getAttribute("data-disabled")).toBe("");
    expect(don.textContent).toContain("Нужны хотя бы две мафии");
  });

  it("при двух мафиях тумблер работает", () => {
    const onChange = renderForm(settings(), 8);
    const don = row("Дон");
    expect(don.getAttribute("data-disabled")).toBe(null);
    fireEvent.click(don.querySelector("button")!);
    expect(onChange.mock.calls[0][0].roles.don).toBe(true);
  });
});
