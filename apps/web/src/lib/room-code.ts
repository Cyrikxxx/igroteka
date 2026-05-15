// Генерация уникального кода комнаты. См. PROMPT.md §2.6.3.
// Алфавит — 32 символа без 0/O/1/I/L, чтобы не путаться при наборе с
// телефона. 6 символов = 32^6 ≈ 1 миллиард вариантов.

import { randomInt } from "node:crypto";
import prisma from "./prisma";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const MAX_TRIES = 5;

export function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== "string" || code.length !== CODE_LEN) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * Генерирует код, отсутствующий в Postgres (`Room.code`).
 * Бросает после `MAX_TRIES` попыток — практически невозможный сценарий.
 */
export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const code = generateCode();
    const exists = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error(
    `Не удалось сгенерировать уникальный код комнаты за ${MAX_TRIES} попыток`,
  );
}
