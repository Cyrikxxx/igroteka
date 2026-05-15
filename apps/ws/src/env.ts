// Загружаем .env из корня монорепо. Импортируется первой строкой в index.ts
// как side-effect (раньше остальных модулей, читающих process.env).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, "../../..", ".env");

try {
  const raw = readFileSync(rootEnvPath, "utf8");
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
  console.log(`[ws] loaded env from ${rootEnvPath}`);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  console.warn(`[ws] no .env at ${rootEnvPath} — relying on process.env only`);
}
