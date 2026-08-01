// Next.js конфиг. Загружаем .env из корня монорепо, чтобы держать секреты
// в одном месте (тот же файл читают prisma cli и WS-сервер).
//
// `next.config.ts` исполняется до того, как Next подгружает env-файлы из
// своего CWD, поэтому ставим переменные в process.env здесь.

import type { NextConfig } from "next";
import { resolve } from "node:path";
import { loadEnvFile } from "@alias/shared/load-env";

// Файла может не быть — в контейнере значения приходят из окружения напрямую.
loadEnvFile(resolve(__dirname, "../../.env"));

const nextConfig: NextConfig = {
  reactCompiler: true,
  // packages/shared — TypeScript-исходники, Next/Turbopack должен
  // транспилировать их при импорте.
  transpilePackages: ["@alias/shared"],
  // Монорепо: говорим трассировщику зависимостей, что корень проекта —
  // на 2 уровня выше apps/web. Без этого в сборку не попадут
  // workspace-зависимости (@alias/shared).
  outputFileTracingRoot: resolve(__dirname, "../.."),
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
