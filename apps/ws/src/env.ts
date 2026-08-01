// Загружаем .env из корня монорепо. Импортируется первой строкой в index.ts
// как side-effect (раньше остальных модулей, читающих process.env).

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "@alias/shared/load-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { loaded, path } = loadEnvFile(resolve(__dirname, "../../..", ".env"));

console.log(
  loaded
    ? `[ws] loaded env from ${path}`
    : `[ws] no .env at ${path} — relying on process.env only`,
);
