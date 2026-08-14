// Русские числительные. Раньше склонения были написаны прямо в лобби
// онлайн-комнаты, а остальные экраны обходились без них — отсюда «2 команд»,
// «1 командах» и «1 слов».

/**
 * Выбирает форму слова по числу.
 *
 * @param n количество
 * @param forms [1, 2, 5] — «команда», «команды», «команд»
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** То же, но с самим числом впереди: `4 игрока`. */
export function pluralize(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}

export const TEAMS: [string, string, string] = ["команда", "команды", "команд"];
export const TEAMS_IN: [string, string, string] = ["команде", "командах", "командах"];
export const PLAYERS: [string, string, string] = ["игрок", "игрока", "игроков"];
export const WORDS: [string, string, string] = ["слово", "слова", "слов"];
export const SPECTATORS: [string, string, string] = ["зритель", "зрителя", "зрителей"];
export const CATEGORIES: [string, string, string] = ["категория", "категории", "категорий"];
