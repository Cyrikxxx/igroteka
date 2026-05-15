"use client";

// Финальный экран. См. DESIGN.md §5.8 VictoryScreen.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import type { GameFromAPI } from "@/types";
import { teamColorVar } from "@/constants/game";
import Header from "@/components/ui/Header";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";

export default function LocalResultsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  const [game, setGame] = useState<GameFromAPI | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/${gameId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить игру");
        return r.json();
      })
      .then(setGame)
      .catch((e: Error) => setError(e.message));
  }, [gameId]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </main>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <p style={{ color: "var(--fg-2)" }}>Загрузка…</p>
        </main>
      </div>
    );
  }

  const sorted = [...game.teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const winnerColor = teamColorVar(winner.order);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 md:px-8 py-10 md:py-16 text-center">
        <div
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6"
          style={{
            background: "color-mix(in oklch, var(--warn) 22%, var(--bg-2))",
            color: "var(--warn)",
          }}
        >
          <Trophy size={36} strokeWidth={2.25} />
        </div>
        <h1 className="h-display mb-3">Победа!</h1>
        <Pill
          mono
          style={{
            background: `color-mix(in oklch, var(${winnerColor}) 22%, var(--bg-2))`,
            color: `var(${winnerColor})`,
          }}
        >
          {winner.name} · {winner.score}
        </Pill>

        <h2 className="h-title mt-10 mb-4 text-left">Финальный счёт</h2>
        <ul className="flex flex-col gap-2 text-left">
          {sorted.map((team, idx) => {
            const c = teamColorVar(team.order);
            const isWinner = idx === 0;
            return (
              <li key={team.id}>
                <Card className="flex items-center gap-3 py-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={
                      isWinner
                        ? { background: "var(--warn)", color: "var(--accent-fg)" }
                        : { background: "var(--bg-3)", color: "var(--fg-2)" }
                    }
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ background: `var(${c})` }}
                  />
                  <span className="flex-1 font-bold">{team.name}</span>
                  <span className="font-mono font-bold tabular-nums">{team.score}</span>
                </Card>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 flex flex-col md:flex-row gap-3 md:justify-center">
          <Button size="lg" variant="secondary" onClick={() => router.push("/")}>
            На главную
          </Button>
          <Button size="lg" onClick={() => router.push("/local/new")}>
            Новая игра
          </Button>
        </div>
      </main>
    </div>
  );
}
