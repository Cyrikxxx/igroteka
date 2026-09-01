// Правила игры втроём: круг из шести ходов.
//
// Троих можно поставить в пару шестью способами, если считать, кто из двоих
// объясняет: 1→2, 1→3, 2→1, 2→3, 3→1, 3→2. Круг — это все шесть, каждый ровно
// один раз, чтобы каждый рассказал каждому и поугадывал у каждого.
//
//   ход  объясняет  угадывает  отдыхает
//    1       1          2          3
//    2       2          3          1
//    3       3          1          2
//    4       2          1          3
//    5       3          2          1
//    6       1          3          2
//
// Первая половина круга проходит три пары, вторая — те же три с обменом
// ролями. За круг каждый дважды объясняет (обоим соседям), дважды угадывает
// (у обоих) и дважды отдыхает.
//
// Индексы здесь — позиции в массиве команд (Team.order). Втроём команда
// состоит из одного человека, поэтому «индекс команды» и «индекс игрока» —
// одно и то же.

import type { GameFormat } from "./domain";

/** Ходов в полном круге. */
export const TRIO_TURNS = 6;

export interface TrioRoles {
  /** Кто объясняет — он же «активная команда» для остального движка. */
  explainer: number;
  /** Кто угадывает и получает те же очки. */
  guesser: number;
  /** Кто пропускает ход и не получает ничего. */
  resting: number;
}

/**
 * Роли на ходу `turn` (0..5). Значения вне диапазона приводятся по модулю —
 * счётчик приходит из базы, и одна кривая запись не должна ронять партию.
 */
export function trioRoles(turn: number): TrioRoles {
  const t = ((turn % TRIO_TURNS) + TRIO_TURNS) % TRIO_TURNS;
  const i = t % 3;
  const a = i;
  const b = (i + 1) % 3;
  // Вторая половина круга — та же пара, но роли наоборот.
  const swapped = t >= 3;
  return {
    explainer: swapped ? b : a,
    guesser: swapped ? a : b,
    resting: (i + 2) % 3,
  };
}

/** Следующий ход в круге. Возврат к нулю означает, что круг сыгран. */
export function nextTrioTurn(turn: number): number {
  return (((turn % TRIO_TURNS) + TRIO_TURNS) % TRIO_TURNS + 1) % TRIO_TURNS;
}

/**
 * Кому засчитывать очки раунда. Единственное место, которое решает «очки
 * обоим»: в обычном режиме это одна команда, втроём — оба игрока пары.
 * Отдыхающий не попадает сюда никогда.
 */
export function scoredTeamIndexes(
  format: GameFormat,
  turn: number,
  explainerIndex: number,
): number[] {
  if (format !== "TRIO") return [explainerIndex];
  const { explainer, guesser } = trioRoles(turn);
  return [explainer, guesser];
}
