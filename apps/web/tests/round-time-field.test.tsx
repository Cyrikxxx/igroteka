// Поле «длительность раунда»: пресеты плюс своё значение.
//
// Сервер принимал произвольное число секунд с самого начала, а форма умела
// только пять кнопок — за столом это заметили первым же вечером. Здесь
// проверяется то, на чём такие поля обычно и ломаются: кламп и черновик.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RoundTimeField from "@/components/alias/RoundTimeField";
import { ROUND_TIME_LIMITS } from "@igroteka/shared/constants";

const FIELD = "Длительность раунда: своё время в секундах";

function open(value = 60) {
  const onChange = vi.fn();
  render(<RoundTimeField value={value} onChange={onChange} />);
  return onChange;
}

describe("длительность раунда в форме", () => {
  it("пресет отдаётся наверх как есть", () => {
    const onChange = open();
    fireEvent.click(screen.getByText("90 сек"));
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it("«Своё» открывает поле ввода", () => {
    open();
    expect(screen.queryByLabelText(FIELD)).toBeNull();
    fireEvent.click(screen.getByText("Своё"));
    expect(screen.getByLabelText(FIELD)).toBeTruthy();
  });

  it("значение не из списка открывает поле сразу", () => {
    // Иначе человек, задавший 75 секунд, при возврате в форму видел бы
    // невыбранные кнопки и не понимал, что у него вообще стоит.
    open(75);
    expect(screen.getByLabelText(FIELD)).toBeTruthy();
  });

  it("своё значение внутри диапазона доезжает наверх", () => {
    const onChange = open();
    fireEvent.click(screen.getByText("Своё"));
    const input = screen.getByLabelText(FIELD);
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it("за границами прижимается к ним", () => {
    const onChange = open();
    fireEvent.click(screen.getByText("Своё"));
    const input = screen.getByLabelText(FIELD);
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(ROUND_TIME_LIMITS.max);
  });

  it("пока печатают — наверх ничего не уходит", () => {
    // Клампить на каждой цифре нельзя: набирая «120», после первой цифры
    // человек получил бы минимум и не смог бы дописать число.
    const onChange = open();
    fireEvent.click(screen.getByText("Своё"));
    const input = screen.getByLabelText(FIELD);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.change(input, { target: { value: "120" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(120);
  });

  it("пустое поле оставляет прежнее значение", () => {
    // Стёр и передумал — подставлять минимум было бы неожиданно.
    const onChange = open();
    fireEvent.click(screen.getByText("Своё"));
    const input = screen.getByLabelText(FIELD);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
