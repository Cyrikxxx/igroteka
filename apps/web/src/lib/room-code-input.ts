// Поле ввода кода комнаты: русская раскладка и фильтрация.
//
// Код набирается латиницей, и на русской раскладке поле раньше просто молчало:
// человек жал клавиши, а в поле ничего не появлялось, и вставить скопированный
// код тоже не выходило. Разводим два случая:
//
//   • Вставка. Код мог быть набран в чужой раскладке ещё до копирования —
//     чиним молча по позиции клавиши: «ЙЦУКЕН» → «QWERTY».
//   • Набор с клавиатуры. Тут раскладка неверная прямо сейчас, и подставлять
//     буквы за человека вредно: он продолжит печатать вслепую. Символы не
//     пропускаем и просим переключить раскладку.

/** Длина кода комнаты. Совпадает с серверной генерацией (lib/room-code.ts). */
export const ROOM_CODE_LENGTH = 6;

/** Русская буква → латинская на той же клавише. */
const BY_KEY: Record<string, string> = {
  Й: "Q", Ц: "W", У: "E", К: "R", Е: "T", Н: "Y", Г: "U", Ш: "I", Щ: "O", З: "P",
  Ф: "A", Ы: "S", В: "D", А: "F", П: "G", Р: "H", О: "J", Л: "K", Д: "L",
  Я: "Z", Ч: "X", С: "C", М: "V", И: "B", Т: "N", Ь: "M",
  Х: "[", Ъ: "]", Ж: ";", Э: "'", Б: ",", Ю: ".", Ё: "`",
};

const CYRILLIC = /[А-ЯЁ]/;

/** Есть ли в тексте кириллица (после приведения к верхнему регистру). */
export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text.toUpperCase());
}

/** «ЙЦУКЕН» → «QWERTY». Символы без пары остаются как есть. */
export function fromRussianLayout(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => BY_KEY[ch] ?? ch)
    .join("");
}

/** Оставляет только то, из чего состоит код. */
function keepCodeChars(text: string): string {
  return text.replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

/**
 * Набор с клавиатуры. Кириллицу не пропускаем, а сообщаем о раскладке —
 * иначе человек печатает вслепую и не понимает, почему поле пустое.
 */
export function typeCode(raw: string): { code: string; wrongLayout: boolean } {
  const upper = raw.toUpperCase();
  return { code: keepCodeChars(upper), wrongLayout: CYRILLIC.test(upper) };
}

/** Вставка: раскладку чиним молча — код мог быть скопирован уже кривым. */
export function pasteCode(raw: string): string {
  return keepCodeChars(fromRussianLayout(raw));
}

/** Текст подсказки под полем. Один на все экраны ввода кода. */
export const WRONG_LAYOUT_HINT = "Код набирается латиницей — переключите раскладку";
