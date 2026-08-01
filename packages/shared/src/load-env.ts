// Мини-парсер .env без внешних зависимостей: web и ws читают один и тот же
// файл в корне монорепо, чтобы секреты лежали в одном месте.
//
// Уже заданные переменные окружения НЕ перезаписываются — в контейнере
// значения приходят снаружи и должны иметь приоритет над файлом.
//
// Путь передаёт вызывающий: web считает его от `__dirname`, ws — от
// `import.meta.url`, и модуль остаётся нейтральным к системе модулей.

import { readFileSync } from "node:fs";

export interface LoadEnvResult {
  /** false — файла нет (это норма в контейнере). */
  loaded: boolean;
  path: string;
}

export function loadEnvFile(path: string): LoadEnvResult {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    return { loaded: true, path };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return { loaded: false, path };
  }
}
