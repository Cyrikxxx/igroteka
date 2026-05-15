"use client";

// Передача устройства перед раундом. См. DESIGN.md §5.5 PassDeviceScreen.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { GameFromAPI } from "@/types";
import { teamColorVar } from "@/constants/game";
import Header from "@/components/ui/Header";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function LocalTurnPage() {
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
      .then((g: GameFromAPI) => {
        if (g.status === "FINISHED") {
          router.replace(`/local/${gameId}/results`);
          return;
        }
        setGame(g);
      })
      .catch((e: Error) => setError(e.message));
  }, [gameId, router]);

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

  const team = game.teams.find((t) => t.order === game.currentTeamIndex)!;
  const player = team.players[team.currentPlayerIndex];
  const colorVar = teamColorVar(team.order);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 md:px-8 py-8 md:py-16">
        <div className="eyebrow mb-4">
          РАУНД {game.currentRoundNumber} · КОМАНДА «{team.name}»
        </div>
        <h1 className="h-display mb-8">
          Передайте<br />устройство
        </h1>

        <Card
          className="text-center mb-6"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklch, var(${colorVar}) 18%, var(--bg-1)), var(--bg-1))`,
            borderColor: `color-mix(in oklch, var(${colorVar}) 35%, var(--line-strong))`,
          }}
        >
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-extrabold mb-4"
            style={{
              background: `color-mix(in oklch, var(${colorVar}) 30%, var(--bg-2))`,
              color: `var(${colorVar})`,
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-2xl font-extrabold tracking-tight">
            {player.name} объясняет
          </div>
          <div className="text-sm mt-2" style={{ color: "var(--fg-2)" }}>
            Угадывают остальные «{team.name}»
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {game.teams.map((t) => (
            <Pill
              key={t.id}
              mono
              style={{
                background: `color-mix(in oklch, var(${teamColorVar(t.order)}) 18%, var(--bg-2))`,
                color: `var(${teamColorVar(t.order)})`,
              }}
            >
              {t.name} · {t.score}
            </Pill>
          ))}
        </div>

        <Button block size="lg" onClick={() => router.push(`/local/${gameId}/round`)}>
          Старт раунда
        </Button>
      </main>
    </div>
  );
}
