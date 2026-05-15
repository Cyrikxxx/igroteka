// Next.js конфиг. Загружаем .env из корня монорепо, чтобы держать секреты
// в одном месте (тот же файл читают prisma cli и WS-сервер).
//
// `next.config.ts` исполняется до того, как Next подгружает env-файлы из
// своего CWD, поэтому ставим переменные в process.env здесь.

import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootEnvPath = resolve(__dirname, "../../.env");
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
} catch (err) {
  // .env может отсутствовать в проде (там Vercel/Railway проставят сами).
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  // packages/shared — TypeScript-исходники, Next/Turbopack должен
  // транспилировать их при импорте.
  transpilePackages: ["@alias/shared"],
  // Разрешаем LAN-устройствам (телефон с того же Wi-Fi) подключаться к
  // dev-серверу. Next.js 16 по умолчанию блокирует cross-origin доступ
  // к /_next/* ресурсам, из-за чего JS-бандлы не грузятся на телефоне.
  // В production эта опция не используется.
  allowedDevOrigins: [
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "26.*.*.*", // Hamachi
  ],
};

export default nextConfig;
