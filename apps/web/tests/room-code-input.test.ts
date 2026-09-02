// Поле кода комнаты на русской раскладке.
//
// Два разных случая, и путать их нельзя: вставленный код чиним молча, а при
// наборе с клавиатуры буквы не пропускаем и просим сменить раскладку.

import { describe, it, expect } from "vitest";
import {
  ROOM_CODE_LENGTH,
  fromRussianLayout,
  hasCyrillic,
  pasteCode,
  typeCode,
} from "../src/lib/room-code-input";

describe("fromRussianLayout", () => {
  it("переводит по позиции клавиши", () => {
    expect(fromRussianLayout("ЙЦУКЕН")).toBe("QWERTY");
    expect(fromRussianLayout("ФЫВАПР")).toBe("ASDFGH");
    expect(fromRussianLayout("ЯЧСМИТ")).toBe("ZXCVBN");
  });

  it("латиницу и цифры не трогает", () => {
    expect(fromRussianLayout("K7F2QD")).toBe("K7F2QD");
  });

  it("регистр не важен", () => {
    expect(fromRussianLayout("йцукен")).toBe("QWERTY");
  });
});

describe("pasteCode — вставка", () => {
  it("код, набранный в русской раскладке, вставляется как надо", () => {
    // «ХЗФ2ЙВ» — это K7F2QD, напечатанное с русской раскладкой… кроме цифры.
    expect(pasteCode("ЙЦУКЕН")).toBe("QWERTY");
  });

  it("мусор и лишние символы отбрасываются", () => {
    expect(pasteCode("  k7f-2qd  ")).toBe("K7F2QD");
  });

  it("длиннее кода не берём", () => {
    expect(pasteCode("ABCDEFGH")).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("ссылку-приглашение целиком не превращаем в код", () => {
    // Из ссылки код берут отдельно; сюда попадает уже он.
    expect(pasteCode("8XL3BL")).toBe("8XL3BL");
  });
});

describe("typeCode — набор с клавиатуры", () => {
  it("русские буквы в поле не попадают", () => {
    const { code, wrongLayout } = typeCode("й");
    expect(code).toBe("");
    expect(wrongLayout).toBe(true);
  });

  it("про раскладку сообщаем, даже если что-то латинское уже набрано", () => {
    const { code, wrongLayout } = typeCode("AБ");
    expect(code).toBe("A");
    expect(wrongLayout).toBe(true);
  });

  it("нормальный набор проходит молча", () => {
    const { code, wrongLayout } = typeCode("k7f2qd");
    expect(code).toBe("K7F2QD");
    expect(wrongLayout).toBe(false);
  });

  it("набранное при верной раскладке не переводится по позиции клавиш", () => {
    // Тут важно, что typeCode НЕ зовёт fromRussianLayout: иначе человек с
    // неверной раскладкой печатал бы вслепую и не понимал, что не так.
    expect(typeCode("ЙЦУКЕН").code).toBe("");
  });
});

describe("hasCyrillic", () => {
  it("находит кириллицу в любом регистре", () => {
    expect(hasCyrillic("абв")).toBe(true);
    expect(hasCyrillic("Ё")).toBe(true);
    expect(hasCyrillic("K7F2QD")).toBe(false);
  });
});
