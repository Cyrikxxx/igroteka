// Условия победы. Ошибка здесь либо завершает партию раньше времени,
// либо не завершает никогда.

import { describe, it, expect } from "vitest";
import { checkWinner } from "../src/games/mafia/services/win";
import { player, snapshot } from "./fixtures";

const dead = { alive: false };

describe("checkWinner", () => {
  it("партия продолжается, пока мафия в меньшинстве", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("civ", "civilian"),
      player("civ2", "civilian"),
    ]);
    expect(checkWinner(s)).toBeNull();
  });

  it("город побеждает, когда мафии и маньяка не осталось", () => {
    const s = snapshot([
      player("maf", "mafia", dead),
      player("civ", "civilian"),
      player("civ2", "civilian"),
    ]);
    expect(checkWinner(s)).toBe("city");
  });

  it("мафия побеждает при паритете", () => {
    const s = snapshot([
      player("maf", "mafia"),
      player("civ", "civilian"),
      player("civ2", "civilian", dead),
    ]);
    expect(checkWinner(s)).toBe("mafia");
  });

  it("маньяк побеждает, оставшись один на один с городом", () => {
    const s = snapshot([
      player("man", "maniac"),
      player("civ", "civilian"),
      player("civ2", "civilian", dead),
    ]);
    expect(checkWinner(s)).toBe("maniac");
  });

  it("маньяк не побеждает, пока горожан больше одного", () => {
    const s = snapshot([
      player("man", "maniac"),
      player("civ", "civilian"),
      player("civ2", "civilian"),
    ]);
    expect(checkWinner(s)).toBeNull();
  });

  it("дон считается за мафию", () => {
    const s = snapshot([
      player("don", "don"),
      player("civ", "civilian"),
      player("civ2", "civilian", dead),
    ]);
    expect(checkWinner(s)).toBe("mafia");
  });

  it("на снапшоте без ролей отвечает city — звать его в лобби нельзя", () => {
    // Характеризующий тест, а не желаемое поведение: checkWinner учитывает
    // только игроков с ролью, поэтому нераспределённое лобби выглядит для
    // него как «мафии не осталось». Вызывающий обязан проверить фазу сам —
    // см. guard в обработчике mafia:leave.
    const s = snapshot(
      [player("a", "civilian"), player("b", "civilian")].map((p) => ({
        ...p,
        role: null,
      })),
      { phase: "LOBBY", day: 0 },
    );
    expect(checkWinner(s)).toBe("city");
  });
});
