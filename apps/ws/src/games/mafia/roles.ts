// Раздача ролей в начале партии. Состав считает общий computeComposition
// (packages/shared/mafia.ts), здесь — сборка пула и случайное распределение.

import {
  computeComposition,
  type MafiaRole,
  type MafiaSnapshot,
} from "@alias/shared/mafia";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Собрать пул ролей по составу (длина = числу игроков). */
export function buildRolePool(n: number, snap: MafiaSnapshot): MafiaRole[] {
  const c = computeComposition(n, snap.settings);
  const pool: MafiaRole[] = [];
  for (let i = 0; i < c.don; i++) pool.push("don");
  for (let i = 0; i < c.mafia; i++) pool.push("mafia");
  for (let i = 0; i < c.sheriff; i++) pool.push("sheriff");
  for (let i = 0; i < c.doctor; i++) pool.push("doctor");
  for (let i = 0; i < c.maniac; i++) pool.push("maniac");
  for (let i = 0; i < c.civilian; i++) pool.push("civilian");
  return pool;
}

/**
 * Раздать роли (мутирует snap): перемешиваем пул, назначаем игрокам,
 * сбрасываем «готов», переводим в ROLE_REVEAL.
 */
export function assignRoles(snap: MafiaSnapshot): void {
  const pool = shuffle(buildRolePool(snap.players.length, snap));
  const order = shuffle(snap.players.map((_, i) => i));
  order.forEach((playerIdx, k) => {
    snap.players[playerIdx].role = pool[k] ?? "civilian";
    snap.players[playerIdx].ready = false;
    snap.players[playerIdx].alive = true;
  });
  snap.phase = "ROLE_REVEAL";
}
