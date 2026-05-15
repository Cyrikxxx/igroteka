// Pure: следующая команда и игрок.
// См. PROMPT.md §2.6.3.

export function nextTurn(args: {
  currentTeamIndex: number;
  currentRoundNumber: number;
  teamsCount: number;
}): { nextTeamIndex: number; nextRoundNumber: number } {
  const nextTeamIndex = (args.currentTeamIndex + 1) % args.teamsCount;
  const nextRoundNumber =
    nextTeamIndex === 0
      ? args.currentRoundNumber + 1
      : args.currentRoundNumber;
  return { nextTeamIndex, nextRoundNumber };
}

/** Следующий currentPlayerIndex внутри команды. */
export function nextPlayerIndex(
  currentPlayerIndex: number,
  playersCount: number,
): number {
  if (playersCount === 0) return 0;
  return (currentPlayerIndex + 1) % playersCount;
}
