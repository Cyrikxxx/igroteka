"use client";

// Финальный экран локальной игры. Дизайн — Victory (см. VictoryView).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameFromAPI } from "@/types";
import AppShell from "@/components/common/AppShell";
import VictoryView from "@/components/alias/game/VictoryView";

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
      <AppShell centered>
        <p style={{ color: "var(--danger)", textAlign: "center" }}>{error}</p>
      </AppShell>
    );
  }
  if (!game) {
    return (
      <AppShell centered>
        <p className="muted" style={{ textAlign: "center" }}>
          Загрузка…
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell centered className="screen-anim">
      <VictoryView
        game={game}
        onHome={() => router.push("/")}
        onRematch={() => router.push("/local/new")}
        rematchLabel="Новая игра"
      />
    </AppShell>
  );
}
