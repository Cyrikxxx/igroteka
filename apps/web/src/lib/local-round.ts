// Незавершённый раунд локальной игры — в localStorage.
//
// Партия целиком живёт на сервере: команды, счёт, чей ход. А вот текущий
// раунд — слова, ответы и таймер — до сих пор существовал только в памяти
// вкладки. Любая перезагрузка посреди раунда стирала его: возвращался новый
// набор слов и полный таймер, а всё, что успели угадать, пропадало.
//
// Здесь раунд переживает перезагрузку. Ключ — на партию: у каждой свой
// незаконченный раунд, и чужой подхватить нельзя.

import type { Countdown } from "@alias/shared/countdown";
import type { WordInRound } from "@/types";

const PREFIX = "alias.localRound.";
/** Меняется, когда меняется форма записи: старое чтение молча отбрасывается. */
const VERSION = 1;

export interface SavedRound {
  v: number;
  /** Слова с уже проставленными ответами. */
  words: WordInRound[];
  /** На каком слове остановились. */
  currentIndex: number;
  /** Идёт раунд или уже открыт экран итогов. */
  phase: "active" | "summary";
  /**
   * Отсчёт как есть: внутри абсолютный момент окончания, поэтому время идёт
   * и пока вкладка закрыта. Так же ведёт себя таймер в онлайне, и заодно
   * перезагрузкой нельзя выпросить себе лишние секунды.
   */
  countdown: Countdown;
}

const key = (gameId: string) => `${PREFIX}${gameId}`;

export function saveRound(gameId: string, state: Omit<SavedRound, "v">): void {
  try {
    localStorage.setItem(key(gameId), JSON.stringify({ v: VERSION, ...state }));
  } catch {
    // Приватный режим или переполненное хранилище — не повод ронять игру.
  }
}

/** Сохранённый раунд или null, если его нет либо запись негодная. */
export function loadRound(gameId: string): SavedRound | null {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRound;
    if (
      parsed?.v !== VERSION ||
      !Array.isArray(parsed.words) ||
      parsed.words.length === 0 ||
      typeof parsed.currentIndex !== "number" ||
      (parsed.phase !== "active" && parsed.phase !== "summary") ||
      !parsed.countdown ||
      typeof parsed.countdown.remainingMs !== "number"
    ) {
      clearRound(gameId);
      return null;
    }
    return parsed;
  } catch {
    clearRound(gameId);
    return null;
  }
}

export function clearRound(gameId: string): void {
  try {
    localStorage.removeItem(key(gameId));
  } catch {
    // см. saveRound
  }
}
