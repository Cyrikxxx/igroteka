import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Тесты лежат в tests/ рядом с пакетом, а не в src/ — так они не попадают
// ни в прод-сборку, ни в tsc --noEmit приложений.
//
// Два раздела с разным окружением. Серверная логика и чистые функции живут в
// node; клиентские тесты — в jsdom, иначе React не отрендерить. Раздел
// выбирается по расширению: .test.ts — node, .test.tsx — браузерное.

const webSrc = fileURLToPath(new URL("./apps/web/src", import.meta.url));
const sharedSrc = fileURLToPath(new URL("./packages/shared/src", import.meta.url));
const stubs = fileURLToPath(new URL("./apps/web/tests/stubs", import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: [
            "apps/*/tests/**/*.test.ts",
            "packages/*/tests/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        // Пути `@/…` и `@alias/shared/…` описаны в apps/web/tsconfig.json —
        // повторяем их здесь, чтобы не тянуть отдельный плагин.
        resolve: {
          alias: {
            // Навигация Next в тестах ненастоящая: страницы читают useParams и
            // дёргают router, а поднимать роутер ради этого незачем.
            "next/navigation": `${stubs}/next-navigation.ts`,
            "@alias/shared": sharedSrc,
            "@/": `${webSrc}/`,
          },
        },
        test: {
          name: "web",
          include: ["apps/web/tests/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./apps/web/tests/setup.ts"],
        },
      },
    ],
  },
});
