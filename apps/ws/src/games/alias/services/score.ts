// Pure: подсчёт очков за раунд и проверка победы.

export interface ScoreInput {
  guessed: number;
  skipped: number;
  penaltySkip: boolean;
  currentTeamScore: number;
}

export interface ScoreResult {
  scoreEarned: number;
  newTeamScore: number;
}

export function scoreRound(input: ScoreInput): ScoreResult {
  const scoreEarned =
    input.guessed - (input.penaltySkip ? input.skipped : 0);
  const newTeamScore = Math.max(0, input.currentTeamScore + scoreEarned);
  return { scoreEarned, newTeamScore };
}

/**
 * Победа считается только в конце круга, когда у всех было поровну ходов.
 * В обычном режиме круг — это проход по всем командам; втроём — шесть ходов,
 * за которые каждый успевает рассказать каждому. Момент передаётся флагом, а
 * не сравнением индекса: у двух режимов он считается по-разному.
 */
export function checkWinner(args: {
  teams: { id: number; score: number }[];
  winScore: number;
  circleDone: boolean;
}): { gameFinished: boolean; winnerTeamId?: number } {
  if (args.winScore <= 0) return { gameFinished: false };
  if (!args.circleDone) return { gameFinished: false };
  const qualified = args.teams.filter((t) => t.score >= args.winScore);
  if (qualified.length === 0) return { gameFinished: false };
  const winner = qualified.reduce((best, t) =>
    t.score > best.score ? t : best,
  );
  return { gameFinished: true, winnerTeamId: winner.id };
}
