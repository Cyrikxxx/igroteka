// Проверка условий победы после каждой смерти.

import { roleTeam, type MafiaSnapshot, type MafiaWinner } from "@alias/shared/mafia";

export function checkWinner(snap: MafiaSnapshot): MafiaWinner | null {
  const alive = snap.players.filter((p) => p.alive && p.role);
  const mafia = alive.filter(
    (p) => p.role === "mafia" || p.role === "don",
  ).length;
  const maniac = alive.filter((p) => p.role === "maniac").length;
  const town = alive.length - mafia - maniac;
  const others = alive.length - mafia; // не-мафия (город + маньяк)

  // Город побеждает, когда не осталось ни мафии, ни маньяка.
  if (mafia === 0 && maniac === 0) return "city";

  // Маньяк против города (мафии нет): побеждает, когда город ≤ 1.
  if (mafia === 0 && maniac > 0) {
    return town <= 1 ? "maniac" : null;
  }

  // Мафия побеждает при паритете: мафии ≥ всех остальных.
  if (mafia > 0 && mafia >= others) return "mafia";

  return null;
}
