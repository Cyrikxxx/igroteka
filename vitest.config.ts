import { defineConfig } from "vitest/config";

// Тесты лежат в tests/ рядом с пакетом, а не в src/ — так они не попадают
// ни в прод-сборку, ни в tsc --noEmit приложений.
export default defineConfig({
  test: {
    include: [
      "apps/*/tests/**/*.test.ts",
      "packages/*/tests/**/*.test.ts",
    ],
    environment: "node",
  },
});
