// Сезонные темы Алиаса: «Новый год», «Хэллоуин» и «Лето».
//
// Они видны всегда — в июле тоже можно сыграть в новогодние слова. Но в свой
// месяц поднимаются наверх списка, чтобы их не искали.

/** Значения поля Category.season. */
export type Season = "newyear" | "halloween" | "summer";

/** Месяцы (1–12), в которые тема считается сезонной. */
const MONTHS: Record<Season, number[]> = {
  newyear: [12, 1],
  halloween: [10],
  summer: [6, 7, 8],
};

/**
 * Сезон ли сейчас для темы. `month` — 1..12; по умолчанию текущий.
 *
 * Месяц передаётся параметром, а не берётся внутри, чтобы функция осталась
 * чистой и её можно было проверить тестом на любую дату.
 */
export function isInSeason(
  season: string | null | undefined,
  month: number = new Date().getMonth() + 1,
): boolean {
  if (!season) return false;
  const months = MONTHS[season as Season];
  return months ? months.includes(month) : false;
}

/**
 * Ключ сортировки: сезонное сейчас идёт первым, всё остальное сохраняет
 * исходный порядок. Годится и для тем внутри подборки, и для подборок.
 */
export function seasonRank(
  season: string | null | undefined,
  month?: number,
): number {
  return isInSeason(season, month) ? 0 : 1;
}
