// Строки карточки истории Алиаса: кто играл, за какую команду и с каким счётом.
//
// Названия команд («Лисы», «Совы») в списке ни о чём не говорят — через неделю
// не вспомнить, кто там был. Поэтому строка на игрока: имя слева, команда и
// счёт справа. Счёт командный, поэтому у соседей по команде он одинаковый —
// строки читаются как таблица.

import type { GameFromAPI } from "@alias/shared/domain";

export interface HistoryLine {
  key: string;
  /** Имя игрока; у команды без состава — её собственное название. */
  name: string;
  /** Команда справа перед счётом. null, когда она и есть игрок (втроём). */
  team: string | null;
  score: number;
  /** CSS-переменная цвета команды, например "--team-1". */
  color: string;
}

export function historyLines(game: GameFromAPI): HistoryLine[] {
  const lines: HistoryLine[] = [];
  for (const team of game.teams) {
    // Втроём команда — это один человек, и её название равно его имени:
    // повторять его во второй колонке незачем.
    const teamLabel = (playerName: string) =>
      team.name.trim() === playerName.trim() ? null : team.name;

    if (team.players.length === 0) {
      // Состава может не быть у брошенной онлайн-партии: в Postgres игроки
      // попадают в момент старта. Пустой карточка при этом остаться не должна.
      lines.push({
        key: `team-${team.id}`,
        name: team.name,
        team: null,
        score: team.score,
        color: team.color,
      });
      continue;
    }

    for (const player of team.players) {
      lines.push({
        key: `player-${player.id}`,
        name: player.name,
        team: teamLabel(player.name),
        score: team.score,
        color: team.color,
      });
    }
  }
  return lines;
}
