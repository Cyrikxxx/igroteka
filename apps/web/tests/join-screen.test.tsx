// Экран входа по коду.
//
// Проверяется то, что легко сломать незаметно: подстановка запомненного имени
// и кода из ссылки. Я уже один раз убрал подстановку вместе с эффектом и
// заметил это только чтением кода — теперь заметит тест.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { resetNavigation, setSearch } from "./stubs/next-navigation";

// Вход в уже знакомую комнату идёт в сеть — здесь это лишнее.
vi.mock("@/lib/room-resume", () => ({
  resumeRoom: vi.fn(async () => null),
}));

import JoinPage from "@/app/alias/join/page";

beforeEach(() => {
  resetNavigation();
  localStorage.clear();
  setSearch("");
});

/** Значения всех полей кода, слева направо. */
function codeCells(): string {
  return screen
    .getAllByRole("textbox")
    .filter((el) => el.getAttribute("maxlength") === "1")
    .map((el) => (el as HTMLInputElement).value)
    .join("");
}

async function renderJoin() {
  await act(async () => {
    render(<JoinPage />);
  });
}

describe("вход по коду (Алиас)", () => {
  it("подставляет запомненное имя", async () => {
    localStorage.setItem("alias.displayName", "Аня");
    await renderJoin();
    const input = screen.getByPlaceholderText("Например, Аня") as HTMLInputElement;
    expect(input.value).toBe("Аня");
  });

  it("без запомненного имени поле пустое", async () => {
    await renderJoin();
    const input = screen.getByPlaceholderText("Например, Аня") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("подставляет код из ссылки-приглашения", async () => {
    setSearch("code=K7F2QD");
    await renderJoin();
    expect(codeCells()).toBe("K7F2QD");
  });

  it("код из ссылки в русской раскладке всё равно подставляется", async () => {
    // По ссылке код может приехать уже перекодированным — «отпустить» человека
    // с ошибкой было бы обидно.
    // «Л7А2ЙВ» — это K7F2QD, набранное на русской раскладке.
    setSearch("code=Л7А2ЙВ");
    await renderJoin();
    expect(codeCells()).toBe("K7F2QD");
  });

  it("неполный код из ссылки не мешает дописать руками", async () => {
    setSearch("code=K7F");
    await renderJoin();
    expect(codeCells()).toBe("K7F");
  });
});
