// Общая подготовка клиентских тестов: после каждого размонтируем дерево,
// иначе соседние тесты видят чужой DOM и падают через раз.

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
