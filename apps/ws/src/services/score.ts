// Pure: подсчёт очков за раунд и проверка победы.
// См. PROMPT.md §2.6.3.

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

/** Победа считается только в конце цикла команд (nextTeamIndex === 0). */
export function checkWinner(args: {
  teams: { id: number; score: number }[];
  winScore: number;
  nextTeamIndex: number;
}): { gameFinished: boolean; winnerTeamId?: number } {
  if (args.winScore <= 0) return { gameFinished: false };
  if (args.nextTeamIndex !== 0) return { gameFinished: false };
  const qualified = args.teams.filter((t) => t.score >= args.winScore);
  if (qualified.length === 0) return { gameFinished: false };
  const winner = qualified.reduce((best, t) =>
    t.score > best.score ? t : best,
  );
  return { gameFinished: true, winnerTeamId: winner.id };
}
