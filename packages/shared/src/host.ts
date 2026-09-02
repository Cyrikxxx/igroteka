// Кто в комнате главный: наследование прав и правила «комната зависла».
//
// Обе игры хранят состав по-разному (у Алиаса — команды и зрители, у Мафии —
// players и spectators), поэтому здесь работаем с плоским списком кандидатов,
// а собирает его каждая игра сама. Раньше логика жила двумя несовместимыми
// копиями и успела разъехаться: одна выбирала наследника с учётом сети,
// вторая — нет, и комната могла достаться тому, кого в ней уже нет.
//
// Главное правило: обрыв связи — не уход. Хост, у которого моргнул Wi-Fi,
// остаётся хостом. Права меняются только когда он вышел сам, или когда его
// нет так долго, что остальные забрали комнату кнопкой.

import { HOST_CLAIM_AFTER_MS, EMPTY_ROOM_TTL_SECONDS, ROOM_TTL_SECONDS } from "./constants";

export interface HostCandidate {
  userId: string;
  online: boolean;
}

/**
 * Кому достаётся комната. Сначала — тот, кто на связи: наследник, которого
 * нет в сети, оставил бы комнату такой же беспомощной, какой она была без
 * хоста. Если на связи нет никого, берём первого по порядку — он станет
 * хостом, когда вернётся.
 */
export function pickHeir<T extends HostCandidate>(
  candidates: readonly T[],
  excludeUserId?: string,
): T | null {
  const pool = excludeUserId
    ? candidates.filter((c) => c.userId !== excludeUserId)
    : candidates;
  return pool.find((c) => c.online) ?? pool[0] ?? null;
}

/**
 * Новое значение hostOfflineSince. Отметка ставится один раз — в момент,
 * когда хост пропал, — и держится, пока он не вернётся: иначе каждый
 * disconnect сбрасывал бы отсчёт и кнопка «взять комнату» не появилась бы
 * никогда.
 */
export function nextHostOfflineSince(args: {
  hostOnline: boolean;
  current: number | null | undefined;
  now?: number;
}): number | null {
  if (args.hostOnline) return null;
  return args.current ?? args.now ?? Date.now();
}

/**
 * Можно ли забрать комнату себе. Проверяется на сервере по серверным часам:
 * клиент показывает кнопку по своим, и его время может врать.
 */
export function canClaimHost(args: {
  hostId: string;
  hostOfflineSince: number | null | undefined;
  claimerId: string;
  claimerOnline: boolean;
  now?: number;
}): boolean {
  if (args.claimerId === args.hostId) return false;
  if (!args.claimerOnline) return false;
  if (!args.hostOfflineSince) return false;
  const now = args.now ?? Date.now();
  return now - args.hostOfflineSince >= HOST_CLAIM_AFTER_MS;
}

/**
 * Сколько секунд жить ключу комнаты в Redis. Пустая комната держится минуты,
 * а не сутки: код освобождается, а вернувшийся в эти минуты застаёт всё на
 * месте. Значение пересчитывается при каждой записи снапшота, поэтому
 * возвращение человека само продлевает жизнь комнаты.
 */
export function roomTtlSeconds(anyoneOnline: boolean): number {
  return anyoneOnline ? ROOM_TTL_SECONDS : EMPTY_ROOM_TTL_SECONDS;
}
