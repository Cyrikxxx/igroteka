// Судьба игрока одной строкой — «кто кем был» на финале и в истории.
//
// Раньше эта функция была написана дважды: на экране финала в комнате и на
// странице сохранённых итогов. Тексты успели разойтись — в одном месте «убит
// ночью 3», в другом «изгнан городом (день 2)», — и день то оказывался в
// скобках, то нет.

import type { MafiaDeathCause } from "@alias/shared/mafia";

export function fateText(by?: MafiaDeathCause | null, day?: number | null): string {
  if (!by) return "выжил";
  const when = day ?? "";
  switch (by) {
    case "mafia":
      return `убит мафией, ночь ${when}`.trim();
    case "maniac":
      return `убит маньяком, ночь ${when}`.trim();
    case "vote":
      return `изгнан городом, день ${when}`.trim();
    case "left":
      return "вышел из партии";
    // Партия кончилась паритетом: мафии столько же, сколько остальных, и
    // сопротивляться больше некому.
    case "overrun":
      return "остался с мафией лицом к лицу";
  }
}
