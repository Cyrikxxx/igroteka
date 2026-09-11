// Подпись «когда это было» в карточке истории.
//
// Свежие партии подписаны словами, старые — числом. Год добавляется, только
// если он не текущий: иначе строка растёт, ничего не добавляя.

import { describe, it, expect } from "vitest";
import { formatDayRu } from "../src/lib/utils";

const NOW = new Date("2026-09-11T14:30:00");

describe("дата партии", () => {
  it("сегодня и вчера — словами, со временем", () => {
    expect(formatDayRu(new Date("2026-09-11T09:05:00"), NOW)).toBe("сегодня, 09:05");
    expect(formatDayRu(new Date("2026-09-10T21:05:00"), NOW)).toBe("вчера, 21:05");
  });

  it("раньше — числом, без времени", () => {
    expect(formatDayRu(new Date("2026-09-03T21:05:00"), NOW)).toBe("3 сент.");
  });

  it("чужой год назван, свой — нет", () => {
    expect(formatDayRu(new Date("2025-12-03T10:00:00"), NOW)).toBe("3 дек. 2025 г.");
    expect(formatDayRu(new Date("2026-01-03T10:00:00"), NOW)).not.toContain("2026");
  });

  it("границу дня считает по календарю, а не по суткам", () => {
    // Час назад, но уже другой день — это «вчера», а не «сегодня».
    const nearMidnight = new Date("2026-09-11T00:30:00");
    expect(formatDayRu(new Date("2026-09-10T23:50:00"), nearMidnight)).toBe("вчера, 23:50");
  });

  it("принимает и метку времени: в истории лежит число", () => {
    expect(formatDayRu(new Date("2026-09-11T09:05:00").getTime(), NOW)).toBe("сегодня, 09:05");
  });
});
